"use client";

import { openDB, DBSchema } from 'idb';
import { parseComfyUiMetadata } from './comfy-parser';

const DB_NAME = 'image-viewer-db';
const METADATA_STORE_NAME = 'images';
const IMAGE_FILES_STORE_NAME = 'image_files';
const DB_VERSION = 12;

// This is the object we'll work with in the application
export interface StoredImage {
  id: number;
  name: string;
  type: string;
  lastModified: number;
  webkitRelativePath: string;
  size: number;
  thumbnail: string;
  workflow: string | null;
  // Advanced metadata
  prompt: string | null;
  negativePrompt: string | null;
  seed: string | null;
  cfg: string | null;
  steps: string | null;
  sampler: string | null;
  scheduler: string | null;
  model: string | null;
  loras: string[];
}

// This interface defines the shape of the data we'll store in IndexedDB.
interface StorableMetadata {
  name: string;
  type: string;
  lastModified: number;
  webkitRelativePath: string;
  thumbnail: string;
  size: number;
  workflow: string | null;
  // Advanced metadata
  prompt: string | null;
  negativePrompt: string | null;
  seed: string | null;
  cfg: string | null;
  steps: string | null;
  sampler: string | null;
  scheduler: string | null;
  model: string | null;
  loras: string[];
}

interface MyDB extends DBSchema {
  [METADATA_STORE_NAME]: {
    key: number;
    value: StorableMetadata;
    indexes: {
      'by-path': string;
      'by-lastModified': number;
      'by-size': number;
      'by-name': string;
      'by-workflow': string;
      'by-prompt': string;
      'by-negativePrompt': string;
      'by-seed': string;
      'by-cfg': string;
      'by-steps': string;
      'by-sampler': string;
      'by-scheduler': string;
      'by-model': string;
      'by-loras': string;
    };
  };
  [IMAGE_FILES_STORE_NAME]: {
    key: number;
    value: File;
  };
}

async function getDb() {
  return openDB<MyDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 12) {
        // If the old metadata store exists, delete it to start fresh with the new structure.
        if (db.objectStoreNames.contains(METADATA_STORE_NAME)) {
          db.deleteObjectStore(METADATA_STORE_NAME);
        }
        // If an old files store exists (from a previous attempt or different schema), delete it.
        if (db.objectStoreNames.contains(IMAGE_FILES_STORE_NAME)) {
          db.deleteObjectStore(IMAGE_FILES_STORE_NAME);
        }

        const metadataStore = db.createObjectStore(METADATA_STORE_NAME, { keyPath: 'id', autoIncrement: true });
        metadataStore.createIndex('by-path', 'webkitRelativePath');
        metadataStore.createIndex('by-lastModified', 'lastModified');
        metadataStore.createIndex('by-size', 'size');
        metadataStore.createIndex('by-name', 'name');
        metadataStore.createIndex('by-workflow', 'workflow');
        metadataStore.createIndex('by-prompt', 'prompt');
        metadataStore.createIndex('by-negativePrompt', 'negativePrompt');
        metadataStore.createIndex('by-seed', 'seed');
        metadataStore.createIndex('by-cfg', 'cfg');
        metadataStore.createIndex('by-steps', 'steps');
        metadataStore.createIndex('by-sampler', 'sampler');
        metadataStore.createIndex('by-scheduler', 'scheduler');
        metadataStore.createIndex('by-model', 'model');
        metadataStore.createIndex('by-loras', 'loras', { multiEntry: true });

        db.createObjectStore(IMAGE_FILES_STORE_NAME);
      }
    },
  });
}

async function processAndStoreFiles(files: File[], onProgress?: (progress: number) => void) {
  const totalFiles = files.length;
  if (totalFiles === 0) {
    onProgress?.(100);
    return;
  }

  const onProgressThrottled = onProgress ? (p: number) => requestAnimationFrame(() => onProgress(p)) : () => {};
  let parsedCount = 0;

  // Step 1: Parse all files in parallel to prepare the data.
  onProgressThrottled(0);
  const preparedData = await Promise.all(files.map(async (file) => {
    try {
      const comfyMetadata = await parseComfyUiMetadata(file);
      const metadata: StorableMetadata = {
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        webkitRelativePath: file.webkitRelativePath,
        thumbnail: '',
        size: file.size,
        workflow: comfyMetadata ? JSON.stringify(comfyMetadata.fullWorkflow) : null,
        prompt: comfyMetadata?.prompt ?? null,
        negativePrompt: comfyMetadata?.negativePrompt ?? null,
        seed: comfyMetadata ? String(comfyMetadata.seed) : null,
        cfg: comfyMetadata ? String(comfyMetadata.cfg) : null,
        steps: comfyMetadata ? String(comfyMetadata.steps) : null,
        sampler: comfyMetadata?.sampler ?? null,
        scheduler: comfyMetadata?.scheduler ?? null,
        model: comfyMetadata?.model ?? null,
        loras: comfyMetadata?.loras ?? [],
      };
      
      parsedCount++;
      onProgressThrottled((parsedCount / totalFiles) * 50); // Parsing is the first 50%

      return { metadata, file };
    } catch (e) {
      console.error(`Skipping file due to error during parsing: ${file.name}`, e);
      parsedCount++;
      onProgressThrottled((parsedCount / totalFiles) * 50);
      return null;
    }
  }));

  const validData = preparedData.filter(Boolean) as { metadata: StorableMetadata; file: File }[];
  const totalToStore = validData.length;
  if (totalToStore === 0) {
    onProgress?.(100);
    return;
  }

  // Step 2: Store all valid data in a single transaction.
  const db = await getDb();
  const tx = db.transaction([METADATA_STORE_NAME, IMAGE_FILES_STORE_NAME], 'readwrite');
  
  let storedCount = 0;
  for (const { metadata, file } of validData) {
    try {
      const metadataId = await tx.objectStore(METADATA_STORE_NAME).add(metadata);
      await tx.objectStore(IMAGE_FILES_STORE_NAME).add(file, metadataId);
    } catch (e) {
      console.error(`Skipping file due to error during storage: ${file.name}`, e);
    }
    storedCount++;
    onProgressThrottled(50 + (storedCount / totalToStore) * 50); // Storing is the second 50%
  }

  await tx.done;
  onProgressThrottled(100);
}

export async function storeImages(files: File[], onProgress?: (progress: number) => void) {
  await clearImages();
  await processAndStoreFiles(files, onProgress);
}

export async function addNewImages(files: File[], onProgress?: (progress: number) => void): Promise<number> {
  const existingMetadata = await getAllStoredImageMetadata();
  const existingPaths = new Set(existingMetadata.map(img => img.webkitRelativePath));
  const newFiles = files.filter(file => !existingPaths.has(file.webkitRelativePath));

  if (newFiles.length > 0) {
    await processAndStoreFiles(newFiles, onProgress);
  }

  return newFiles.length;
}

export async function getAllStoredImageMetadata(): Promise<StoredImage[]> {
  const db = await getDb();
  const tx = db.transaction(METADATA_STORE_NAME, 'readonly');
  const store = tx.store;
  const images: StoredImage[] = [];
  let cursor = await store.openCursor();
  while (cursor) {
    images.push({ ...cursor.value, id: cursor.primaryKey });
    cursor = await cursor.continue();
  }
  return images;
}

export async function getStoredImageFile(id: number): Promise<File | null> {
  const db = await getDb();
  
  // Fetch both metadata and the file blob in parallel
  const [metadata, file] = await Promise.all([
    db.get(METADATA_STORE_NAME, id),
    db.get(IMAGE_FILES_STORE_NAME, id)
  ]);

  if (!metadata || !file) return null;

  // Re-attach the webkitRelativePath to the file object for consistency
  Object.defineProperty(file, 'webkitRelativePath', {
    value: metadata.webkitRelativePath,
    writable: false,
    configurable: true,
  });

  return file;
}

export async function clearImages() {
  const db = await getDb();
  // Clear both object stores
  await Promise.all([
    db.clear(METADATA_STORE_NAME),
    db.clear(IMAGE_FILES_STORE_NAME)
  ]);
}