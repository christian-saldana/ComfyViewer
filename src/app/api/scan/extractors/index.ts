import { promises as fs } from 'fs';
import path from 'path';

import { FileMetadata } from '../../types';

import ComfyUI from './comfyui';
import { canExtractFooocus, extractFooocus } from './fooocus';


export default async function scanDirectory(directoryPath: string, rootPath: string, existingPaths?: Set<string>): Promise<FileMetadata[]> {
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
        } else if (entry.isFile()) {
            // If existingPaths is provided, skip files we already know about.
            if (existingPaths && existingPaths.has(fullPath)) {
                return [];
            }

            try {
                const comfyUIMetadata = await ComfyUI.extractMetadata(entry.name, fullPath, rootPath)
                if (comfyUIMetadata) return comfyUIMetadata
                const fooocusMetadata = await extractFooocus(entry.name, fullPath, rootPath)
                if (fooocusMetadata) return fooocusMetadata
                return []

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