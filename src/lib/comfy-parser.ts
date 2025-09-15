import { getMetadata } from 'meta-png';
import ExifReader from 'exifreader';

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


function extractPromptJson(prompt: string): string | null {
  const match = prompt.match(/prompt:(\{.*\})$/is);
  return match ? match[1] : null;
}

export async function parseComfyUiMetadata(file: File): Promise<ComfyMetadata | null> {
  try {
    const buffer = await file.arrayBuffer();
    const view = new Uint8Array(buffer);
    let promptText: string | null | undefined = null;
    // Strategy 1: Try to parse as PNG and get 'prompt' metadata
    if (file.type === 'image/png') {
      try {
        promptText = getMetadata(view, "prompt");
      } catch (e) {
        console.warn(`Could not read 'prompt' chunk from PNG ${file.name}, trying other methods.`, e);
      }
    }

    // Strategy 2: Try to parse EXIF data (for JPEG, WebP, etc.)
    if (!promptText) {
      try {
        const tags = ExifReader.load(buffer);

        const candidates = [
          tags.PNGPrompt, tags.PNGWorkflow,                 // some builds map these
          tags["PNG:prompt"], tags["PNG:workflow"],         // direct tags
          tags.ImageDescription, tags.Description,
          tags.XMP?.description, tags.Software,
          tags.Comment, tags?.Make?.description,
          tags?.Model?.description
        ].flatMap(v => Array.isArray(v) ? v : [v]).filter(Boolean);

        for (const c of candidates) {
          if (typeof c !== "string") continue;
          promptText = extractPromptJson(c)
        }

      } catch (e) {
        console.error('Error parsing non-png file:', e)
      }
    }

    // If no metadata was found with any strategy, return null.
    if (!promptText) {
      return null;
    }

    const jsonStart = promptText.indexOf("{");
    const jsonEnd = promptText.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      console.warn("Could not find a valid JSON workflow in the metadata.");
      return null;
    }

    let jsonString = promptText.substring(jsonStart, jsonEnd + 1).replace(/NaN/g, "null");
    const workflow = JSON.parse(jsonString);

    const ksamplerNodeEntry = Object.values(workflow).find(
      (node: any) =>
        ["KSampler", "KSamplerAdvanced", "SharkSampler_Beta", "SamplerCustomAdvanced"].includes(node.class_type)
    );

    const modelLoaderNode = Object.values(workflow).find(
      (node: any) => ["CheckpointLoaderSimple", "CheckpointLoader", "UNet loader with Name (Image Saver)", "UNETLoader", "UnetLoaderGGUF"].includes(node.class_type)
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

    const CFGGuider = Object.values(workflow).find(
      (node: any) => node.class_type === "CFGGuider"
    )

    const scheduler = Object.values(workflow).find(
      (node: any) => node.class_type === "BasicScheduler"
    )

    const seed = Object.values(workflow).find(
      (node: any) => node.class_type === "RandomNoise"
    )

    if (!ksamplerNodeEntry) {
      // Can't find a sampler, but we can still show the full workflow JSON.
      return {
        prompt: "N/A", negativePrompt: "N/A", seed: "N/A", cfg: "N/A",
        steps: "N/A", sampler: "N/A", scheduler: "N/A", model, loras, fullWorkflow: workflow,
      };
    }

    const ksamplerNode = ksamplerNodeEntry as any;
    const guiderNode = CFGGuider as any;
    const schedulerNode = scheduler as any;
    const seedNode = seed as any;

    const samplerInputs = ksamplerNode?.inputs
    const guiderInputs = guiderNode?.inputs
    const scheduleInputs = schedulerNode?.inputs
    const seedInputs = seedNode?.inputs

    let prompt = findPromptText(workflow, samplerInputs?.positive ?? guiderInputs?.positive);
    let negativePrompt = findPromptText(workflow, samplerInputs?.negative ?? guiderInputs?.negative);

    // Fallback to searching by title if tracing fails
    if (prompt === "N/A") {
      const positivePromptNode = Object.values(workflow).find((node: any) => {
        let match
        match = node._meta?.title?.toLowerCase().includes("positive prompt")
        if (match) return true
        match = node._meta?.title?.toLowerCase().includes("Positive Prompt")
        if (match) return true
        return false
      }
      ) as any;
      if (positivePromptNode?.inputs?.text) {
        prompt = findPromptText(workflow, positivePromptNode.inputs.text);
      }
    }
    if (negativePrompt === "N/A") {
      const negativePromptNode = Object.values(workflow).find((node: any) => {
        let match
        match = node._meta?.title?.toLowerCase().includes("negative prompt")
        if (match) return true
        match = node._meta?.title?.toLowerCase().includes("Negative Prompt")
        if (match) return true
        return false
      }
      ) as any;
      if (negativePromptNode?.inputs?.text) {
        negativePrompt = findPromptText(workflow, negativePromptNode.inputs.text);
      }
    }

    const parsedData: ComfyMetadata = {
      prompt: prompt,
      negativePrompt: negativePrompt,
      seed: resolveValue(workflow, samplerInputs?.seed ?? seedInputs?.noise_seed) ?? "N/A",
      cfg: resolveValue(workflow, samplerInputs?.cfg ?? guiderInputs?.cfg) ?? "N/A",
      steps: resolveValue(workflow, samplerInputs?.steps ?? scheduleInputs?.steps) ?? "N/A",
      sampler: resolveValue(workflow, samplerInputs?.sampler_name ?? samplerInputs.sampler) ?? "N/A",
      scheduler: resolveValue(workflow, samplerInputs?.scheduler ?? scheduleInputs?.scheduler) ?? "N/A",
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