import { promises as fs } from 'fs';
import path from 'path';

import ExifReader from 'exifreader';
import { getMetadata } from 'meta-png';
import sizeOf from 'image-size';

// Types
export interface ServerImageMetadata {
  name: string;
  type: string;
  lastModified: number;
  webkitRelativePath: string;
  size: number;
  workflow: string | null;
  prompt: string | null;
  negativePrompt: string | null;
  seed: string | null;
  cfg: string | null;
  steps: string | null;
  sampler: string | null;
  scheduler: string | null;
  model: string | null;
  loras: any[]; // Simplified for now
  fullPath: string,
  width: number,
  height: number
}

type InputValue = string | number | undefined;
interface WorkflowNode {
  inputs: Record<string, InputValue>;
  class_type: string;
  _meta?: { title?: string };
}
type WorkflowData = Record<string, WorkflowNode>;

// --- Metadata Extraction and Parsing Functions ---

function getWorkflowStringFromPng(buffer: Buffer): string | null | undefined {
  try { return getMetadata(new Uint8Array(buffer), "prompt"); } catch (e) { return null; }
}

function getWorkflowStringFromExif(buffer: Buffer): string | null {
  try {
    const tags = ExifReader.load(buffer);
    const candidates = [tags.PNGPrompt, tags.PNGWorkflow, tags["PNG:prompt"], tags["PNG:workflow"], tags.ImageDescription, tags.Description, tags.XMP?.description, tags.Software, tags.Comment, tags?.Make?.description, tags?.Model?.description].flatMap(v => Array.isArray(v) ? v : [v]).filter(Boolean);
    for (const candidate of candidates) {
      if (typeof candidate !== "string") continue;
      const match = candidate.match(/prompt:(\{.*\})$/is);
      if (match && match[1]) return match[1];
    }
    return null;
  } catch (e) { return null; }
}

async function getWorkflowJson(filePath: string, buffer: Buffer): Promise<any | null> {
  let workflowString: string | null | undefined = null;
  if (path.extname(filePath).toLowerCase() === '.png') {
    workflowString = getWorkflowStringFromPng(buffer);
  }
  if (!workflowString) {
    workflowString = getWorkflowStringFromExif(buffer);
  }
  if (!workflowString) return null;
  try { return JSON.parse(workflowString.replace(/NaN/g, "null")); } catch (e) { return null; }
}

const resolveValue = (workflow: WorkflowData, input: InputValue): string | number => {
  if (!Array.isArray(input) || typeof input[0] !== 'string' || !workflow[input[0]]) return input ?? "N/A";
  const sourceNode = workflow[input[0]];
  if (sourceNode?.inputs) {
    const keys = ['value', '_int', 'float', 'sampler_name'];
    for (const key of keys) {
      const value = sourceNode.inputs[key];
      if (value !== undefined) return value as string | number;
    }
  }
  return "N/A";
};

const findPromptText = (workflow: WorkflowData, startLink: InputValue): string => {
  let currentLink = startLink;
  for (let i = 0; i < 10; i++) {
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

const findNode = (workflow: WorkflowData, classTypes: string[]): WorkflowNode | undefined => Object.values(workflow).find((node) => classTypes.includes(node.class_type));
const findNodeByTitle = (workflow: WorkflowData, titles: string[]): WorkflowNode | undefined => {
  const lowerCaseTitles = titles.map(t => t.toLowerCase());
  return Object.values(workflow).find((node) => node?._meta?.title && lowerCaseTitles.includes(node._meta.title.toLowerCase()));
};

function extractPrompts(workflow: WorkflowData, samplerNode: WorkflowNode | undefined, guiderNode: WorkflowNode | undefined): { prompt: string, negativePrompt: string } {
  let prompt = findPromptText(workflow, guiderNode?.inputs?.conditioning ?? samplerNode?.inputs?.positive);
  let negativePrompt = findPromptText(workflow, guiderNode?.inputs?.negative ?? samplerNode?.inputs?.negative);
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

function extractModelAndLoras(workflow: WorkflowData): { model: string | null, loras: any[] } {
  const modelLoaderNode = findNode(workflow, ["CheckpointLoaderSimple", "CheckpointLoader", "UNet loader with Name (Image Saver)", "UNETLoader", "UnetLoaderGGUF", "ChromaDiffusionLoader"]);
  const model: string | null = (modelLoaderNode?.inputs?.ckpt_name as string) ?? (modelLoaderNode?.inputs?.unet_name as string) ?? "N/A";
  const loraLoaderNodes = Object.values(workflow).filter((node) => node.class_type === "LoraLoader");
  const loras: any[] = loraLoaderNodes.map(node => ({ name: node.inputs.lora_name as string, strength_model: resolveValue(workflow, node.inputs.strength_model), strength_clip: resolveValue(workflow, node.inputs.strength_clip) })).filter(lora => lora.name);
  return { model, loras };
}

async function parseComfyUiMetadataServer(filePath: string, buffer: Buffer): Promise<Partial<ServerImageMetadata>> {
  const workflow = await getWorkflowJson(filePath, buffer);
  if (!workflow) return {};
  const { model, loras } = extractModelAndLoras(workflow);
  const ksamplerNode = findNode(workflow, ["KSampler", "KSamplerAdvanced", "SharkSampler_Beta", "SamplerCustomAdvanced"]);
  const guiderNode = findNode(workflow, ["CFGGuider", "FluxGuidance"]);
  const schedulerNode = findNode(workflow, ["BasicScheduler"]);
  const seedNode = findNode(workflow, ["RandomNoise"]);
  if (!ksamplerNode) return { workflow: JSON.stringify(workflow), prompt: "N/A", negativePrompt: "N/A", seed: "N/A", cfg: "N/A", steps: "N/A", sampler: "N/A", scheduler: "N/A", model, loras };
  const { prompt, negativePrompt } = extractPrompts(workflow, ksamplerNode, guiderNode);
  const samplerInputs = ksamplerNode.inputs;
  const guiderInputs = guiderNode?.inputs;
  const scheduleInputs = schedulerNode?.inputs;
  const seedInputs = seedNode?.inputs;
  return { workflow: JSON.stringify(workflow), prompt, negativePrompt, seed: String(resolveValue(workflow, samplerInputs.seed ?? seedInputs?.noise_seed) ?? "N/A"), cfg: String(resolveValue(workflow, samplerInputs.cfg ?? guiderInputs?.cfg) ?? "NA"), steps: String(resolveValue(workflow, samplerInputs.steps ?? scheduleInputs?.steps) ?? "N/A"), sampler: String(resolveValue(workflow, samplerInputs.sampler_name ?? samplerInputs.sampler) ?? "N/A"), scheduler: String(resolveValue(workflow, samplerInputs.scheduler ?? scheduleInputs?.scheduler) ?? "N/A"), model, loras };
}

// --- File Scanning Logic ---

export async function scanDirectory(directoryPath: string, rootPath: string, existingPaths?: Set<string>): Promise<ServerImageMetadata[]> {
  let entries;
  try {
    entries = await fs.readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    console.error(`Error reading directory ${directoryPath}:`, error);
    if (directoryPath === rootPath) { // Only throw for the top-level directory
      throw new Error(`Could not read directory: ${directoryPath}. Please ensure the path is correct and accessible.`);
    }
    return []; // Return empty for subdirectories to not fail the whole scan
  }

  const filePromises = entries.map(async (entry) => {
    const fullPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      return scanDirectory(fullPath, rootPath, existingPaths);
    } else if (entry.isFile() && entry.name.match(/\.(png|jpg|jpeg|webp)$/i)) {
      // If existingPaths is provided, skip files we already know about.
      if (existingPaths && existingPaths.has(fullPath)) {
        return [];
      }

      try {
        const stats = await fs.stat(fullPath);
        const buffer = await fs.readFile(fullPath);
        const dimensions = sizeOf(buffer);
        const comfyMetadata = await parseComfyUiMetadataServer(fullPath, buffer);

        return [{
          name: entry.name,
          type: `image/${path.extname(entry.name).substring(1)}`,
          lastModified: stats.mtimeMs,
          webkitRelativePath: path.relative(rootPath, fullPath),
          size: stats.size,
          workflow: null, prompt: null, negativePrompt: null, seed: null, cfg: null, steps: null, sampler: null, scheduler: null, model: null, loras: [],
          ...comfyMetadata,
          fullPath: fullPath,
          width: dimensions.width ?? 0,
          height: dimensions.height ?? 0,
        }];
      } catch (fileError) {
        console.warn(`Could not process file ${fullPath}:`, fileError);
        return [];
      }
    }
    return [];
  });

  const nestedResults = await Promise.all(filePromises);
  return nestedResults.flat();
}