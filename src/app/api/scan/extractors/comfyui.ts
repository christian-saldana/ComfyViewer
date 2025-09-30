import { promises as fs } from 'fs';
import path from 'path';

import { exiftool, Tags } from 'exiftool-vendored';

import { FileMetadata } from '../../types';

type InputValue = string | number | undefined;
interface WorkflowNode {
    inputs: Record<string, InputValue>;
    class_type: string;
    _meta?: { title?: string };
}
type WorkflowData = Record<string, WorkflowNode>;

function extractWorkflowFromTags(tags: Tags): WorkflowData | null {
    // Common fields where tools embed JSON/workflow blobs
    const preferredKeys = [
        'Prompt',
        'Model',
        'XMP:Description',
        'Description',
        'Make',
        'ImageDescription',
        'Comment',
        'UserComment',
        'QuickTime:Comment',
        'QuickTime:UserData',
        'com.apple.quicktime.comment',
        'com.adobe.xmp',
        'XPComment',
        'Notes',
        'Workflow'
    ];
    // Normalize tags into a flat key/value map of strings
    const flat: Array<[string, string]> = [];
    for (const [k, v] of Object.entries(tags)) {
        if (v == null) continue;
        if (typeof v === 'string') flat.push([k, v]);
        else if (Array.isArray(v)) {
            for (const el of v) {
                if (typeof el === 'string') flat.push([k, el]);
            }
        } else if (typeof v === 'object') {
            // Sometimes ExifTool returns objects with a .value
            const val = (v as any).value;
            if (typeof val === 'string') flat.push([k, val]);
        }
    }

    // 1) Check preferred keys first
    for (const key of preferredKeys) {
        const hit = flat.find(([k]) => k.toLowerCase() === key.toLowerCase());
        if (hit) {
            if (key === "UserComment") {
                try { return JSON.parse(hit[1].replace(/NaN/g, "null")); } catch (e) { return null; }
            } else if (key === "Comment") {
                try { return JSON.parse(JSON.parse(hit[1].replace(/NaN/g, "null")).prompt) } catch (e) { return null; }
            } else {
                const maybe = findJsonOrPrompt(hit[1]);
                if (maybe) {
                    try { return JSON.parse(maybe.replace(/NaN/g, "null")); } catch (e) { return null; }
                }
            }
        }
    }

    // 2) Scan all string values as a fallback
    for (const [, val] of flat) {
        const maybe = findJsonOrPrompt(val);
        if (maybe) {
            try { return JSON.parse(maybe.replace(/NaN/g, "null")); } catch (e) { return null; }
        }
    }

    return null;
}

function findJsonOrPrompt(text: string): string | null {
    // Common pattern: "prompt:{...}" or "workflow:{...}"
    const suffixMatch = text.match(/(?:prompt|workflow)\s*:\s*(\{[\s\S]*\})\s*$/i);
    if (suffixMatch?.[1]) return suffixMatch[1];

    // Any JSON object in the string (greedy but pragmatic)
    const anyJson = text.match(/\{[\s\S]*\}/);
    if (anyJson?.[0]) return anyJson[0];

    return null;
}

const resolveValue = (workflow: WorkflowData, input: InputValue): string | number => {
    if (!Array.isArray(input) || typeof input[0] !== 'string' || !workflow[input[0]]) return input ?? "N/A";
    const sourceNode = workflow[input[0]];
    if (sourceNode?.inputs) {
        // May need to pass in a keys array since this will vary per node type
        const keys = ['value', '_int', 'float', 'sampler_name'];
        for (const key of keys) {
            const value = sourceNode.inputs[key];
            if (value !== undefined) return value as string | number;
        }
    }
    return "N/A";
};

const resolveSchedulerValue = (workflow: WorkflowData, input: InputValue): string | number => {
    if (!Array.isArray(input) || typeof input[0] !== 'string' || !workflow[input[0]]) return input ?? "N/A";
    const sourceNode = workflow[input[0]];
    if (sourceNode?.inputs) {
        // May need to pass in a keys array since this will vary per node type
        const keys = ['value', '_int', 'float', 'scheduler'];
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
        if (typeof sourceNode.inputs.prompt === 'string') return sourceNode.inputs.prompt;
        if (typeof sourceNode.inputs.positive === 'string') return sourceNode.inputs.positive;
        if (Array.isArray(sourceNode.inputs.positive)) return findPromptText(workflow, sourceNode.inputs.positive);
        if (Array.isArray(sourceNode.inputs.text1)) return findPromptText(workflow, sourceNode.inputs.text1);
        currentLink = sourceNode.inputs.text || sourceNode.inputs.string;
    }

    return "N/A";
};

const findNode = (workflow: WorkflowData, classTypes: string[]): WorkflowNode | undefined => Object.values(workflow).find((node) => classTypes.includes(node.class_type));
const findNodeByTitle = (workflow: WorkflowData, titles: string[]): WorkflowNode | undefined => {
    const lowerCaseTitles = titles.map(t => t.toLowerCase());
    return Object.values(workflow).find((node) => node?._meta?.title && lowerCaseTitles.includes(node._meta.title.toLowerCase()));
};

function extractModelAndLoras(workflow: WorkflowData): { model: string | null, loras: any[] } {
    const modelLoaderNode = findNode(workflow, ["CheckpointLoaderSimple", "CheckpointLoader", "UNet loader with Name (Image Saver)", "UNETLoader", "UnetLoaderGGUF", "ChromaDiffusionLoader", "WanImageToVideo", "VHS_VideoCombine"]);
    const model: string | null = (modelLoaderNode?.inputs?.ckpt_name as string) ?? (modelLoaderNode?.inputs?.unet_name as string) ?? "N/A";
    const loraLoaderNodes = Object.values(workflow).filter((node) => ["LoraLoader", "LoraLoaderModelOnly"].includes(node.class_type));
    let loras: any[] = loraLoaderNodes.map(node => ({ name: node.inputs.lora_name as string, strength_model: resolveValue(workflow, node.inputs.strength_model), strength_clip: resolveValue(workflow, node.inputs.strength_clip) })).filter(lora => lora.name);

    if (loras.length === 0) {
        const [loraManager]: any = Object.values(workflow).filter((node) => ["Lora Loader (LoraManager)"].includes(node.class_type));
        if (loraManager) {
            loras = loraManager?.inputs?.loras?.__value__.map((lora: { name: string; strength: any; clipStrength: any; }) => ({ name: lora.name as string, strength_model: lora.strength, strength_clip: lora.clipStrength })).filter((lora: { name: any; }) => lora.name);
        }
    }
    return { model, loras };
}

function extractPrompts(workflow: WorkflowData, samplerNode: WorkflowNode | undefined, guiderNode: WorkflowNode | undefined): { prompt: string, negativePrompt: string } {
    let prompt = findPromptText(workflow, guiderNode?.inputs?.conditioning ?? guiderNode?.inputs?.positive ?? samplerNode?.inputs?.positive);
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

function parseComfyUiMetadataServer(workflow: WorkflowData): Partial<FileMetadata> {
    const { model, loras } = extractModelAndLoras(workflow);
    const ksamplerNode = findNode(workflow, ["KSampler", "KSamplerAdvanced", "SharkSampler_Beta", "ClownsharKSampler_Beta", "SamplerCustomAdvanced", "LanPaint_KSampler"]);
    const samplerNode = findNode(workflow, ["KSamplerSelect"])
    const guiderNode = findNode(workflow, ["CFGGuider", "FluxGuidance"]);
    const schedulerNode = findNode(workflow, ["BasicScheduler"]);
    const seedNode = findNode(workflow, ["RandomNoise", "ttN seed", "PrimitiveInt"]);
    const { prompt, negativePrompt } = extractPrompts(workflow, ksamplerNode, guiderNode);

    const kSamplerInputs = ksamplerNode?.inputs;
    const samplerInputs = samplerNode?.inputs
    const guiderInputs = guiderNode?.inputs;
    const scheduleInputs = schedulerNode?.inputs;
    const seedInputs = seedNode?.inputs;
    const seed = String(resolveValue(workflow, kSamplerInputs?.seed ?? kSamplerInputs?.noise_seed ?? seedInputs?.seed ?? seedInputs?.noise_seed ?? seedInputs?.value) ?? "N/A")
    const steps = String(resolveValue(workflow, kSamplerInputs?.steps ?? scheduleInputs?.steps) ?? "N/A")
    const sampler = String(resolveValue(workflow, kSamplerInputs?.sampler_name ?? kSamplerInputs?.sampler ?? samplerInputs?.sampler) ?? "N/A")
    const scheduler = String(resolveSchedulerValue(workflow, scheduleInputs?.scheduler ?? kSamplerInputs?.scheduler) ?? "N/A")
    return {
        workflow: JSON.stringify(workflow),
        prompt,
        negativePrompt,
        seed: seed,
        steps: steps,
        sampler: sampler,
        scheduler: scheduler,
        model,
        loras,
        ...(guiderInputs ? { guidance: String(resolveValue(workflow, guiderInputs?.guidance ?? guiderInputs?.cfg) ?? "N/A") } : { cfg: String(resolveValue(workflow, kSamplerInputs?.cfg ?? samplerInputs?.cfg) ?? "N/A") })
    };
}

const extractMetadata = async (fileName: string, fullPath: string, rootPath: string): Promise<FileMetadata | null> => {
    try {
        const metadata = await exiftool.read(fullPath);
        if (metadata) {
            const workflow = extractWorkflowFromTags(metadata)
            if (workflow) {
                const workflowData = parseComfyUiMetadataServer(workflow)
                const stats = await fs.stat(fullPath);
                return {
                    name: fileName,
                    source: 'ComfyUI',
                    type: `${fullPath.match(/\.(mp4)$/i) ? 'video' : 'image'}/${path.extname(fileName).substring(1)}`,
                    lastModified: stats.mtimeMs,
                    webkitRelativePath: path.relative(rootPath, fullPath),
                    size: stats.size,
                    workflow: null, prompt: null, negativePrompt: null, seed: null, cfg: null, steps: null, sampler: null, scheduler: null, model: null, loras: [],
                    ...workflowData,
                    fullPath: fullPath,
                    width: metadata.ImageWidth ?? 0,
                    height: metadata.ImageHeight ?? 0,
                    ...(fullPath.endsWith('.mp4') ? { frameRate: metadata.VideoFrameRate ?? 0, duration: metadata.Duration } : {})
                };
            }
        }
        return null
    } catch (err) {
        console.warn(`Could not process file ${fullPath}:`, err);
        return null;
    }
};

export default { extractMetadata }
