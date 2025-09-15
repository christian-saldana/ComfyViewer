"use client";

import ExifReader from 'exifreader';
import { getMetadata } from 'meta-png';

export interface ComfyMetadata {
  prompt: string;
  negativePrompt: string;
  seed: number | string;
  cfg: number | string;
  steps: number | string;
  sampler: string;
  scheduler: string;
  model: string | null;
  loras: string[];
  fullWorkflow: object;
}

// --- Workflow Extraction ---

function getWorkflowStringFromPng(view: Uint8Array): string | null {
  try {
    return getMetadata(view, "prompt");
  } catch (e) {
    console.warn("Could not read 'prompt' chunk from PNG, trying other methods.", e);
    return null;
  }
}

function getWorkflowStringFromExif(buffer: ArrayBuffer): string | null {
  try {
    const tags = ExifReader.load(buffer);
    const candidates = [
      tags.PNGPrompt, tags.PNGWorkflow,
      tags["PNG:prompt"], tags["PNG:workflow"],
      tags.ImageDescription, tags.Description,
      tags.XMP?.description, tags.Software,
      tags.Comment, tags?.Make?.description,
      tags?.Model?.description
    ].flatMap(v => Array.isArray(v) ? v : [v]).filter(Boolean);

    for (const candidate of candidates) {
      if (typeof candidate !== "string") continue;
      const match = candidate.match(/prompt:(\{.*\})$/is);
      if (match && match[1]) return match[1];
    }
    return null;
  } catch (e) {
    console.error('Error parsing EXIF data:', e);
    return null;
  }
}

async function getWorkflowJson(file: File): Promise<object | null> {
  const buffer = await file.arrayBuffer();
  let workflowString: string | null = null;

  if (file.type === 'image/png') {
    workflowString = getWorkflowStringFromPng(new Uint8Array(buffer));
  }

  if (!workflowString) {
    workflowString = getWorkflowStringFromExif(buffer);
  }

  if (!workflowString) return null;

  try {
    const jsonString = workflowString.replace(/NaN/g, "null");
    return JSON.parse(jsonString);
  } catch (e) {
    console.warn("Could not parse workflow JSON from metadata.", e);
    return null;
  }
}

// --- Workflow Parsing Helpers ---

const resolveValue = (workflow: any, input: any): any => {
  if (!Array.isArray(input) || typeof input[0] !== 'string' || !workflow[input[0]]) {
    return input;
  }
  const sourceNode = workflow[input[0]];
  if (sourceNode?.inputs) {
    const keys = ['value', '_int', 'float', 'sampler_name'];
    for (const key of keys) {
      if (sourceNode.inputs[key] !== undefined) return sourceNode.inputs[key];
    }
  }
  return "N/A";
};

const findPromptText = (workflow: any, startLink: any): string => {
  let currentLink = startLink;
  for (let i = 0; i < 10; i++) { // Safety break for cycles
    if (typeof currentLink === 'string') return currentLink;
    if (!Array.isArray(currentLink) || typeof currentLink[0] !== 'string' || !workflow[currentLink[0]]) break;

    const sourceNode = workflow[currentLink[0]];
    if (!sourceNode?.inputs) break;

    if (typeof sourceNode.inputs.text === 'string') return sourceNode.inputs.text;
    if (typeof sourceNode.inputs.string === 'string') return sourceNode.inputs.string;

    currentLink = sourceNode.inputs.text || sourceNode.inputs.string;
  }
  return "N/A";
};

const findNode = (workflow: any, classTypes: string[]): any | undefined => {
  return Object.values(workflow).find((node: any) => classTypes.includes(node.class_type));
};

const findNodeByTitle = (workflow: any, titles: string[]): any | undefined => {
  const lowerCaseTitles = titles.map(t => t.toLowerCase());
  return Object.values(workflow).find((node: any) =>
    node?._meta?.title && lowerCaseTitles.includes(node._meta.title.toLowerCase())
  );
};

function extractPrompts(workflow: any, samplerNode: any, guiderNode: any): { prompt: string, negativePrompt: string } {
  let prompt = findPromptText(workflow, samplerNode?.inputs?.positive ?? guiderNode?.inputs?.positive);
  let negativePrompt = findPromptText(workflow, samplerNode?.inputs?.negative ?? guiderNode?.inputs?.negative);

  if (prompt === "N/A") {
    const positiveNode = findNodeByTitle(workflow, ["positive prompt", "Positive Prompt"]);
    if (positiveNode?.inputs?.text) prompt = findPromptText(workflow, positiveNode.inputs.text);
  }
  if (negativePrompt === "N/A") {
    const negativeNode = findNodeByTitle(workflow, ["negative prompt", "Negative Prompt"]);
    if (negativeNode?.inputs?.text) negativePrompt = findPromptText(workflow, negativeNode.inputs.text);
  }
  return { prompt, negativePrompt };
}

function extractModelAndLoras(workflow: any): { model: string | null, loras: string[] } {
  const modelLoaderNode = findNode(workflow, [
    "CheckpointLoaderSimple", "CheckpointLoader", "UNet loader with Name (Image Saver)",
    "UNETLoader", "UnetLoaderGGUF", "ChromaDiffusionLoader"
  ]) as any;

  let model: string | null = modelLoaderNode?.inputs?.ckpt_name ?? modelLoaderNode?.inputs?.unet_name ?? "N/A";

  const loraLoaderNodes = Object.values(workflow).filter((node: any) => node.class_type === "LoraLoader") as any[];
  const loras = loraLoaderNodes.map(node => node.inputs.lora_name).filter(Boolean);

  return { model, loras };
}

// --- Main Exported Function ---

export async function parseComfyUiMetadata(file: File): Promise<ComfyMetadata | null> {
  const workflow = await getWorkflowJson(file);
  if (!workflow) return null;

  const { model, loras } = extractModelAndLoras(workflow);

  const ksamplerNode = findNode(workflow, ["KSampler", "KSamplerAdvanced", "SharkSampler_Beta", "SamplerCustomAdvanced"]);
  const guiderNode = findNode(workflow, ["CFGGuider"]);
  const schedulerNode = findNode(workflow, ["BasicScheduler"]);
  const seedNode = findNode(workflow, ["RandomNoise"]);

  if (!ksamplerNode) {
    return {
      prompt: "N/A", negativePrompt: "N/A", seed: "N/A", cfg: "N/A",
      steps: "N/A", sampler: "N/A", scheduler: "N/A", model, loras, fullWorkflow: workflow,
    };
  }

  const { prompt, negativePrompt } = extractPrompts(workflow, ksamplerNode, guiderNode);

  const samplerInputs = ksamplerNode.inputs;
  const guiderInputs = guiderNode?.inputs;
  const scheduleInputs = schedulerNode?.inputs;
  const seedInputs = seedNode?.inputs;

  return {
    prompt,
    negativePrompt,
    seed: resolveValue(workflow, samplerInputs.seed ?? seedInputs?.noise_seed) ?? "N/A",
    cfg: resolveValue(workflow, samplerInputs.cfg ?? guiderInputs?.cfg) ?? "NA",
    steps: resolveValue(workflow, samplerInputs.steps ?? scheduleInputs?.steps) ?? "N/A",
    sampler: resolveValue(workflow, samplerInputs.sampler_name ?? samplerInputs.sampler) ?? "N/A",
    scheduler: resolveValue(workflow, samplerInputs.scheduler ?? scheduleInputs?.scheduler) ?? "N/A",
    model,
    loras,
    fullWorkflow: workflow,
  };
}