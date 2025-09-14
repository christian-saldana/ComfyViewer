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

// Helper to resolve a value, which might be a direct value or a link to another node's input.
const resolveValue = (workflow: any, input: any): any => {
  if (!Array.isArray(input) || typeof input[0] !== 'string' || !workflow[input[0]]) {
    return input; // It's a direct value
  }
  const sourceNode = workflow[input[0]];
  if (sourceNode && sourceNode.inputs) {
    // Common primitive node input names
    if (sourceNode.inputs.value !== undefined) return sourceNode.inputs.value;
    if (sourceNode.inputs._int !== undefined) return sourceNode.inputs._int;
    if (sourceNode.inputs.float !== undefined) return sourceNode.inputs.float;
    if (sourceNode.inputs.sampler_name !== undefined) return sourceNode.inputs.sampler_name;
  }
  return "N/A";
};

// Helper to trace back through links to find the ultimate text prompt.
const findPromptText = (workflow: any, startLink: any): string => {
  let currentLink = startLink;
  for (let i = 0; i < 10; i++) { // Safety break for circular dependencies
    if (typeof currentLink === 'string') return currentLink;
    if (!Array.isArray(currentLink) || typeof currentLink[0] !== 'string' || !workflow[currentLink[0]]) {
      break;
    }
    const sourceNode = workflow[currentLink[0]];
    if (!sourceNode || !sourceNode.inputs) break;

    // Found the text, return it
    if (typeof sourceNode.inputs.text === 'string') return sourceNode.inputs.text;
    // Some custom nodes use 'string'
    if (typeof sourceNode.inputs.string === 'string') return sourceNode.inputs.string;

    // Follow the link to the next node
    currentLink = sourceNode.inputs.text || sourceNode.inputs.string;
  }
  return "N/A";
};

export async function parseComfyUiMetadata(file: File): Promise<ComfyMetadata | null> {
  if (file.type !== 'image/png') {
    return null;
  }

  try {
    const buffer = await file.arrayBuffer();
    const pngBytes = new Uint8Array(buffer);
    const promptText = getMetadata(pngBytes, "prompt");

    if (!promptText) {
      return null; // No metadata, but not an error.
    }

    const jsonStart = promptText.indexOf("{");
    const jsonEnd = promptText.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      console.warn("Could not find a valid JSON workflow in the metadata.");
      return null;
    }

    let jsonString = promptText.substring(jsonStart, jsonEnd + 1).replace(/NaN/g, "null");
    const workflow = JSON.parse(jsonString);

    const ksamplerNodeEntry = Object.entries(workflow).find(
      ([, node]: [string, any]) =>
        ["KSampler", "KSamplerAdvanced", "SharkSampler_Beta"].includes(node.class_type)
    );

    const modelLoaderNode = Object.values(workflow).find(
      (node: any) => ["CheckpointLoaderSimple", "CheckpointLoader", "UNet loader with Name (Image Saver)"].includes(node.class_type)
    ) as any;
    let model
    if (modelLoaderNode?.inputs?.ckpt_name) {
      model = modelLoaderNode?.inputs?.ckpt_name
    } else if (modelLoaderNode?.inputs?.unet_name) {
      model = modelLoaderNode?.inputs?.unet_name
    }

    const loraLoaderNodes = Object.values(workflow).filter(
      (node: any) => node.class_type === "LoraLoader"
    ) as any[];
    const loras = loraLoaderNodes.map(node => node.inputs.lora_name).filter(Boolean);

    if (!ksamplerNodeEntry) {
      // Can't find a sampler, but we can still show the full workflow JSON.
      return {
        prompt: "N/A", negativePrompt: "N/A", seed: "N/A", cfg: "N/A",
        steps: "N/A", sampler: "N/A", scheduler: "N/A", model, loras, fullWorkflow: workflow,
      };
    }

    const ksamplerNode = ksamplerNodeEntry[1] as any;
    const inputs = ksamplerNode.inputs;

    let prompt = findPromptText(workflow, inputs.positive);
    let negativePrompt = findPromptText(workflow, inputs.negative);

    // Fallback to searching by title if tracing fails
    if (prompt === "N/A") {
      const positivePromptNode = Object.values(workflow).find(
        (node: any) => node._meta?.title?.toLowerCase().includes("positive prompt")
      ) as any;
      if (positivePromptNode?.inputs?.text) {
        prompt = findPromptText(workflow, positivePromptNode.inputs.text);
      }
    }
    if (negativePrompt === "N/A") {
      const negativePromptNode = Object.values(workflow).find(
        (node: any) => node._meta?.title?.toLowerCase().includes("negative prompt")
      ) as any;
      if (negativePromptNode?.inputs?.text) {
        negativePrompt = findPromptText(workflow, negativePromptNode.inputs.text);
      }
    }

    const parsedData: ComfyMetadata = {
      prompt: prompt,
      negativePrompt: negativePrompt,
      seed: resolveValue(workflow, inputs.seed) ?? "N/A",
      cfg: resolveValue(workflow, inputs.cfg) ?? "N/A",
      steps: resolveValue(workflow, inputs.steps) ?? "N/A",
      sampler: resolveValue(workflow, inputs.sampler_name || inputs.sampler) ?? "N/A",
      scheduler: resolveValue(workflow, inputs.scheduler) ?? "N/A",
      model,
      loras,
      fullWorkflow: workflow,
    };

    return parsedData;

  } catch (e) {
    console.error("Failed to parse metadata:", e);
    return null;
  }
}