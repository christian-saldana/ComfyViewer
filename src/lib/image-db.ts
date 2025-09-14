"use client";

import { openDB, DBSchema } from 'idb';
import { parseComfyUiMetadata } from './comfy-parser';

const DB_NAME = 'image-viewer-db';
const STORE_NAME = 'images';
const DB_VERSION = 11;

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
  [STORE_NAME]: {
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
}

async function getDb() {
  return openDB<MyDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 11) {
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('by-path', 'webkitRelativePath');
        store.createIndex('by-lastModified', 'lastModified');
        store.createIndex('by-size', 'size');
        store.createIndex('by-name', 'name');
        store.createIndex('by-workflow', 'workflow');
        store.createIndex('by-prompt', 'prompt');
        store.createIndex('by-negativePrompt', 'negativePrompt');
        store.createIndex('by-seed', 'seed');
        store.createIndex('by-cfg', 'cfg');
        store.createIndex('by-steps', 'steps');
        store.createIndex('by-sampler', 'sampler');
        store.createIndex('by-scheduler', 'scheduler');
        store.createIndex('by-model', 'model');
        store.createIndex('by-loras', 'loras', { multiEntry: true });
      }
    },
  });
}

let opfsWorker: Worker | null = null;

function getOpfsWorker() {
  if (typeof window === 'undefined') return null;        // SSR guard
  if (!opfsWorker) {
    opfsWorker = new Worker(
      new URL('./opfs-worker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return opfsWorker;
}

export async function saveViaWorker(file: File, parse = false): Promise<void> {
  const worker = getOpfsWorker();
  if (!worker) throw new Error('saveViaWorker must run in the browser');

  const buf = await file.arrayBuffer();
  return new Promise<void>((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      worker.removeEventListener('message', onMessage);
      if (e.data?.ok) resolve();
      else reject(new Error(e.data?.error ?? 'Worker failed'));
    };
    worker.addEventListener('message', onMessage);
    worker.postMessage({ name: file.name, bytes: buf, parse }, [buf]);
  });
}

async function withPool<T>(items: T[], limit: number, fn: (item: T, i: number) => Promise<void>) {
  const q = [...items].entries();
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (const [i, item] of q) await fn(item, i);
  });
  await Promise.all(workers);
}

async function processAndStoreFiles(files: File[], onProgress?: (progress: number) => void) {
  const db = await getDb();

  let processedCount = 0;
  const totalFiles = files.length;
  const CHUNK_SIZE = 500;
  const metadataChunk: StorableMetadata[] = [];

  for (let i = 0; i < totalFiles; i += CHUNK_SIZE) {
    console.log('chunks', i)
    const chunk = files.slice(i, i + CHUNK_SIZE);
    try {
      const CONCURRENCY = 6; // tune 4–8

      await withPool(chunk, CONCURRENCY, async (file) => {
        // OPFS write
        await saveViaWorker(file, /*parse*/ false);

        // (Option A) Defer parsing to a second pass (fastest ingest)
        // (Option B) Parse now (see worker version below)
        const comfyMetadata = await parseComfyUiMetadata(file);
        metadataChunk.push({
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
        });
        processedCount++;
      });
    } catch (e) {
      console.error('Error', e);
    }

    if (onProgress) {
      onProgress((processedCount / totalFiles) * 100);
    }
    console.log('metadataChunk', metadataChunk)
    if (metadataChunk.length > 0) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      for (const m of metadataChunk) await tx.store.add(m);
      await tx.done;
    }
  }
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
  const tx = db.transaction(STORE_NAME, 'readonly');
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
  const metadata = await db.get(STORE_NAME, id);
  if (!metadata) return null;

  try {
    const root = await navigator.storage.getDirectory();
    const imagesDir = await root.getDirectoryHandle('images');
    const fileHandle = await imagesDir.getFileHandle(metadata.name);
    const file = await fileHandle.getFile();

    Object.defineProperty(file, 'webkitRelativePath', {
      value: metadata.webkitRelativePath,
      writable: false,
    });
    return file;
  } catch (e) {
    console.error(`Failed to retrieve file "${metadata.name}" from OPFS. It may have been deleted or moved.`, e);
    return null;
  }
}

export async function clearImages() {
  const db = await getDb();
  await db.clear(STORE_NAME);

  try {
    const root = await navigator.storage.getDirectory();
    const imagesDir = await root.getDirectoryHandle('images');
    for await (const key of imagesDir.keys()) {
      await imagesDir.removeEntry(key);
    }
  } catch (e) {
    console.error("Failed to clear Origin Private File System:", e);
  }
}