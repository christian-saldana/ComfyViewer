import { ExifDateTime } from "exiftool-vendored";

export interface FileMetadata {
    name: string;
    source: string;
    type: string;
    lastModified: string | ExifDateTime | number;
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