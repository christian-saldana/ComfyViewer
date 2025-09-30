import { promises as fs } from 'fs';
import path from 'path';

import { exiftool } from "exiftool-vendored";

import { FileMetadata } from '../../types';


export interface LoraInfo {
    name: string;
    strength_model: number;
}

export interface FooocusResult {
    source: "Fooocus";
    workflow: Record<string, any>;
    prompt?: string;
    negativePrompt?: string;
    steps?: number;
    sampler?: string;
    cfg?: number;
    seed?: number;
    model?: string;
    scheduler?: string; // Schedule type → scheduler
    width?: number;
    height?: number;
    version?: string;   // Version → version
    styles?: any;
    loras?: LoraInfo[];
    type: string;
    name: string;
    webkitRelativePath: string;
}

export type GetExifMetadataFn = (mediaPath: string) => Promise<Record<string, any>>;

// ---------- Public API (functions) ----------

/** Check if image likely contains Fooocus metadata */
export async function canExtractFooocus(
    name: string,
    mediaPath: string,
    rootPath: string
): Promise<boolean> {
    if (path.extname(mediaPath).toLowerCase() === ".mp4") return false;

    const metadata = await exiftool.read(mediaPath);

    // 1) JSON inside "parameters"
    if ("parameters" in metadata) {
        try {
            const params = metadata["parameters"];
            if (typeof params === "string") {
                const data = JSON.parse(params);
                if (
                    data &&
                    typeof data === "object" &&
                    (String(data).toLowerCase().includes("fooocus") ||
                        "metadata_scheme" in (data as any))
                ) {
                    return true;
                }
            }
        } catch { /* ignore */ }
    }

    // 2) explicit marker
    if ("fooocus_scheme" in metadata) return true;

    // 3) older textual hints
    for (const field of ["Parameters", "UserComment", "Comment", "Description", "comment", "description"]) {
        if (field in metadata) {
            const text = String(metadata[field] ?? "");
            if (text.includes("Fooocus") || (text.includes("Steps:") && text.includes("Sampler:"))) {
                return true;
            }
        }
    }

    return false;
}

/** Extract structured Fooocus data (or null if nothing useful). */
export async function extractFooocus(
    name: string,
    imagePath: string,
    rootPath: string
): Promise<FileMetadata | null> {
    try {
        const metadata = await exiftool.read(imagePath);

        const result: any = { source: "Fooocus", workflow: {} };

        // Prefer JSON in "parameters"
        if ("parameters" in metadata) {
            try {
                const params = metadata["parameters"];
                if (typeof params === "string") {
                    const data = JSON.parse(params);
                    if (data && typeof data === "object") {
                        result.workflow = JSON.stringify(data);
                        Object.assign(result, extractFromJson(data));

                        if ("fooocus_scheme" in metadata) {
                            result.workflow = JSON.stringify(metadata["fooocus_scheme"]);
                        }
                        return result;
                    }
                }
            } catch {
                // fall through to text
            }
        }

        // Fallback to textual fields
        let metadataText: string | null = null;
        for (const field of ["Parameters", "UserComment", "Comment", "Description", "comment", "description"]) {
            if (field in metadata && metadata[field]) {
                metadataText = String(metadata[field]);
                result.workflow = JSON.stringify(metadataText);
                break;
            }
        }

        if (!metadataText) return null;

        const stats = await fs.stat(imagePath);

        Object.assign(result, extractFromText(metadataText));

        return {
            workflow: null, prompt: null, negativePrompt: null, seed: null, cfg: null, steps: null, sampler: null, scheduler: null, model: null, loras: [],
            ...result,
            name: name,
            source: 'Fooocus',
            type: `${imagePath.match(/\.(mp4)$/i) ? 'video' : 'image'}/${path.extname(imagePath).substring(1)}`,
            lastModified: stats.mtimeMs,
            webkitRelativePath: path.relative(rootPath, imagePath),
            size: stats.size,
            fullPath: imagePath,
            ...(imagePath.endsWith('.mp4') ? { frameRate: metadata.VideoFrameRate ?? 0, duration: metadata.Duration } : {})
        }
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`Failed to extract Fooocus metadata from ${imagePath}:`, e);
        return null;
    }
}

// ---------- Internals (pure helpers) ----------

function extractFromText(text: string): Partial<FooocusResult> {
    const extracted: Partial<FooocusResult> = {};
    const loras: LoraInfo[] = [];

    const lines = text.trim().split(/\r?\n/);

    const promptLines: string[] = [];
    let negativeSection = false;
    let parametersSection = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith("Negative prompt:")) {
            negativeSection = true;
            let neg = line.split("prompt:", 2)?.[1].trim() ?? ""

            // Multi-line negative prompt continues until a parameter line
            let j = i + 1;
            while (j < lines.length && !isParameterLine(lines[j])) {
                neg += " " + lines[j].trim();
                j++;
            }
            extracted.negativePrompt = neg;
        } else if (isParameterLine(line)) {
            parametersSection = true;
            parseParameterLine(line, extracted, loras);
        } else if (!negativeSection && !parametersSection) {
            // Collect positive prompt lines
            promptLines.push(line);
        }
    }
    // Build positive prompt, clean scaffolding tokens, and pull out inline <lora:...> tags
    if (promptLines.length) {
        const assembled = promptLines.join("\n").trim();

        // 1) remove matrix-prompt scaffolding tokens like ADDBASE/ADDCOL/ADDROW (ignore case, with commas/spaces)
        const noScaffold = assembled
            .replace(/\s*,?\s*(ADD(?:BASE|COL|ROW))\s*,?\s*/gi, " ")
            .replace(/\s{2,}/g, " ")
            .replace(/\s*,\s*,/g, ",")
            .trim();

        // 2) extract inline LoRA tags like <lora:Name:0.6> and remove them from the prompt
        const { cleaned, found } = extractAngleBracketLoras(noScaffold);
        if (found.length) {
            // merge with any loras found later in parameter line
            for (const l of found) loras.push(l);
        }

        // 3) after cleanup, trim leading/trailing commas/spaces
        const finalPrompt = cleaned.replace(/^[,;\s]+|[,;\s]+$/g, "").trim();
        if (finalPrompt) extracted.prompt = finalPrompt;
    }

    if (loras.length) {
        // Optional: dedupe by name, keep last weight
        const byName = new Map<string, number>();
        for (const l of loras) byName.set(l.name, l.strength_model);
        extracted.loras = Array.from(byName, ([name, strength_model]) => ({ name, strength_model }));
    }

    return extracted;
}

// Consider more keys here to mark the start of the parameter block
function isParameterLine(line: string): boolean {
    return /^\s*(?:Steps|Sampler|CFG\s+scale|Seed|Size|Model|Schedule\s+type|Version|Lora\s+hashes|LoRAs?)\s*:/i.test(line);
}

/**
 * Robust key:value parser for lines like:
 * Steps: 35, Sampler: DPM++ 2M, Schedule type: Karras, CFG scale: 6, Seed: 4053627810, Size: 1344x1728, ...
 * - Handles quoted values that contain commas, e.g. RP Ratios: "1,2,3"
 */
function parseParameterLine(
    line: string,
    extracted: Partial<FooocusResult>,
    loras?: LoraInfo[]
): void {
    const lorasArr = loras ?? [];

    // key: (quoted|"..."|unquoted up to next comma or end)
    const pairRe = /([A-Za-z][A-Za-z\s]*?):\s*("(?:[^"\\]|\\.)*"|[^,]+)(?=,|$)/g;
    let m: RegExpExecArray | null;

    while ((m = pairRe.exec(line)) !== null) {
        const rawKey = m[1].trim();
        let rawVal = m[2].trim();

        // strip surrounding quotes
        if (rawVal.startsWith("\"") && rawVal.endsWith("\"")) {
            rawVal = rawVal.slice(1, -1);
        }

        const key = rawKey.toLowerCase();

        switch (key) {
            case "steps":
                extracted.steps = safeInt(rawVal);
                break;
            case "sampler":
                extracted.sampler = rawVal;
                break;
            case "cfg scale":
                extracted.cfg = safeFloat(rawVal);
                break;
            case "seed":
                extracted.seed = safeInt(rawVal);
                break;
            case "model":
                extracted.model = rawVal;
                break;
            case "size": {
                // "1344x1728"
                const [w, h] = rawVal.split("x").map(s => s.trim());
                if (w && h) {
                    extracted.width = safeInt(w);
                    extracted.height = safeInt(h);
                }
                break;
            }
            case "schedule type":
            case "scheduler":
            case "schedule":
                extracted.scheduler = rawVal;
                break;
            case "version":
                extracted.version = rawVal;
                break;

            // Optional: LoRA lists if present as "LoRAs: name:0.8, other:1.0"
            case "loras":
            case "lora":
                parseLorasFromText(rawVal, lorasArr);
                break;

            // You can add more cases here (e.g., "clip skip", "model hash") if you want to lift them
            // into structured fields. Otherwise they remain only in raw_metadata["Parameters"].
            default:
                break;
        }
    }

    if (lorasArr.length) {
        extracted.loras = (extracted.loras ?? []).concat(lorasArr);
    }
}

function extractAngleBracketLoras(promptText: string): { cleaned: string; found: LoraInfo[] } {
    const found: LoraInfo[] = [];
    let cleaned = promptText;

    // Matches <lora:Name> or <lora:Name:0.6>
    const tagRe = /<\s*lora\s*:\s*([^:>]+?)(?:\s*:\s*([0-9.]+))?\s*>/gi;

    cleaned = cleaned.replace(tagRe, (_m, name: string, weight?: string) => {
        const loraName = cleanLoraName(String(name));
        const strength_model = weight !== undefined ? safeFloat(weight) ?? 1.0 : 1.0;
        if (loraName) {
            found.push({ name: loraName, strength_model: strength_model });
        }
        // remove the tag from the prompt
        return " ";
    });

    // trim extra whitespace created by removals
    cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
    return { cleaned, found };
}

function cleanLoraName(name: string): string {
    let clean = name.trim().replace(/\.safetensors$/i, "").replace(/\.ckpt$/i, "");
    if (clean.includes("/")) clean = clean.split("/").pop()!;
    if (clean.includes("\\")) clean = clean.split("\\").pop()!;
    return clean;
}

function parseLorasFromText(lorasText: string, loras: LoraInfo[]): void {
    // Accepts:
    //  - "lora1:0.8, lora2:1.0"
    //  - "lora1 (0.8), lora2 (1.0)"
    //  - "lora1, lora2"  (defaults to 1.0)
    const entries = lorasText.split(",").map(s => s.trim()).filter(Boolean);

    for (const entry of entries) {
        let name = "";
        let strength_model = 1.0;

        const paren = entry.match(/^(.+?)\s*\(([0-9.]+)\)$/);
        if (paren) {
            name = paren[1].trim();
            strength_model = safeFloat(paren[2]) ?? 1.0;
        } else if (entry.includes(":")) {
            const [loraName, w] = entry.split(":", 2);
            name = (loraName ?? "").trim();
            strength_model = safeFloat((w ?? "").trim()) ?? 1.0;
        } else {
            name = entry.trim();
        }

        if (name) {
            name = cleanLoraName(name);
            loras.push({ name, strength_model });
        }
    }
}

function extractFromJson(data: Record<string, any>): Partial<FooocusResult> {
    const out: Partial<FooocusResult> = {};

    if ("prompt" in data) out.prompt = data["prompt"];
    if ("negativePrompt" in data) out.negativePrompt = data["negativePrompt"];
    if ("base_model" in data) out.model = data["base_model"];
    if ("steps" in data) out.steps = safeInt(data["steps"]);
    if ("guidance_scale" in data) out.cfg = safeFloat(data["guidance_scale"]);
    if ("seed" in data) out.seed = safeInt(data["seed"]);
    if ("sampler" in data) out.sampler = data["sampler"];
    if ("scheduler" in data) out.scheduler = data["scheduler"];

    // resolution e.g. "(1152, 896)"
    if ("resolution" in data) {
        const res = String(data["resolution"] ?? "").trim();
        const trimmed = res.replace(/[()]/g, "");
        const [w, h] = trimmed.split(",").map(s => s?.trim());
        if (w && h) {
            out.width = safeInt(w);
            out.height = safeInt(h);
        }
    }

    if ("version" in data) out.version = data["version"];
    if ("styles" in data) out.styles = data["styles"];

    const loras: LoraInfo[] = [];

    // Explicit array
    if (Array.isArray(data["loras"])) {
        for (const item of data["loras"]) {
            if (item && typeof item === "object") {
                const name =
                    item["name"] ??
                    item["name"] ??
                    "";
                const strength_modelRaw =
                    item["weight"] ??
                    item["strength"] ??
                    item["model_strength"] ??
                    1.0;

                if (name) {
                    const clean = cleanLoraName(String(name));
                    loras.push({
                        name: clean,
                        strength_model: safeFloat(strength_modelRaw) ?? 1.0,
                    });
                }
            }
        }
    }

    // Keys like lora1, lora2 with *_weight/_strength/_model_strength
    const loraKeys = Object.keys(data).filter(
        k =>
            k.startsWith("lora") &&
            !k.endsWith("_weight") &&
            !k.endsWith("_strength") &&
            !k.endsWith("_model_strength")
    );

    for (const key of loraKeys) {
        const name = data[key];
        if (typeof name === "string" && name) {
            let weight: any = 1.0;
            for (const suffix of ["_weight", "_strength", "_model_strength"]) {
                const candidate = data[`${key}${suffix}`];
                if (candidate !== undefined) {
                    weight = candidate;
                    break;
                }
            }

            const clean = cleanLoraName(name);
            loras.push({
                name: clean,
                strength_model: safeFloat(weight) ?? 1.0,
            });
        }
    }

    if (loras.length) out.loras = loras;
    return out;
}

function safeInt(v: any): number | undefined {
    if (v === null || v === undefined) return undefined;
    const n =
        typeof v === "number"
            ? Math.trunc(v)
            : parseInt(String(v).replace(/[^\d-]/g, ""), 10);
    return Number.isFinite(n) ? n : undefined;
}

function safeFloat(v: any): number | undefined {
    if (v === null || v === undefined) return undefined;
    const n =
        typeof v === "number"
            ? v
            : parseFloat(String(v).replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : undefined;
}
