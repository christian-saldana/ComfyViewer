"use client";

import { DBSchema, openDB } from 'idb';

import { Lora, parseComfyUiMetadata } from './image-parser';
import { isFirefox, preflightQuotaOrPersist, toGiB } from './utils';

const DB_NAME = 'comfy-viewer-db';
const METADATA_STORE_NAME = 'images';
const IMAGE_FILES_STORE_NAME = 'image_files';
const DIRECTORY_HANDLE_STORE_NAME = 'directory_handles';
const DB_VERSION = 14;

// This is the object we'll work with in the application
export interface StoredImage {
  id: number;
  name: string;
  type: string;
  lastModified: number;
  webkitRelativePath: string;
  size: number;
  width: number;
  height: number;
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
  loras: Lora[];
}

// This interface defines the shape of the data we'll store in IndexedDB.
interface StorableMetadata {
  name: string;
  type: string;
  lastModified: number;
  webkitRelativePath: string;
  thumbnail: string;
  size: number;
  width: number;
  height: number;
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
  loras: Lora[];
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
    };
  };
  [IMAGE_FILES_STORE_NAME]: {
    key: number;
    value: File;
  };
  [DIRECTORY_HANDLE_STORE_NAME]: {
    key: string;
    value: FileSystemDirectoryHandle;
  };
}

async function getDb() {
  return openDB<MyDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 14) {
        // The structure of the 'loras' property has changed from string[] to Lora[].
        // The simplest, most reliable way to handle this is to recreate the stores.
        if (db.objectStoreNames.contains(METADATA_STORE_NAME)) {
          db.deleteObjectStore(METADATA_STORE_NAME);
        }
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

        db.createObjectStore(IMAGE_FILES_STORE_NAME);
      }
      if (oldVersion < 13 && oldVersion !== 0) { // Handle older versions if not starting from scratch
        if (!db.objectStoreNames.contains(DIRECTORY_HANDLE_STORE_NAME)) {
          db.createObjectStore(DIRECTORY_HANDLE_STORE_NAME);
        }
      }
    },
  });
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = (err) => {
        console.error("Error loading image for dimension check:", err);
        // Resolve with 0x0 so it doesn't block processing other images
        resolve({ width: 0, height: 0 });
      };
      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        resolve({ width: 0, height: 0 });
      }
    };
    reader.onerror = (err) => {
      console.error("Error reading file for dimension check:", err);
      resolve({ width: 0, height: 0 });
    };
    reader.readAsDataURL(file);
  });
}

async function processAndStoreFiles(files: File[], onProgress?: (progress: number) => void) {
  const totalFiles = files.length;
  if (totalFiles === 0) {
    onProgress?.(100);
    return;
  }

  const onProgressThrottled = onProgress ? (p: number) => requestAnimationFrame(() => onProgress(p)) : () => { };

  onProgressThrottled(0);
  const preparedData: { metadata: any, file: any }[] = []

  const parsingBatch = 500
  let parsedCount = 0;
  for (let i = 0; i < files.length; i += parsingBatch) {
    const chunk = files.slice(i, i + parsingBatch);

    await Promise.all(chunk.map(async (file) => {
      try {
        const [comfyMetadata, dimensions] = await Promise.all([
          parseComfyUiMetadata(file),
          getImageDimensions(file),
        ]);
        const metadata: StorableMetadata = {
          name: file.name,
          type: file.type,
          lastModified: file.lastModified,
          webkitRelativePath: file.webkitRelativePath,
          thumbnail: '',
          size: file.size,
          width: dimensions.width,
          height: dimensions.height,
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

        preparedData.push({ metadata, file });
      } catch (e) {
        console.error(`Skipping file due to error during parsing: ${file.name}`, e);
        parsedCount++;
        onProgressThrottled((parsedCount / totalFiles) * 50);
        return null;
      }
    }))
  }

  const validData = preparedData.filter(Boolean) as { metadata: StorableMetadata; file: File }[];
  const totalToStore = validData.length;
  if (totalToStore === 0) {
    onProgress?.(100);
    return;
  }

  const db = await getDb();
  const tx = db.transaction([METADATA_STORE_NAME, IMAGE_FILES_STORE_NAME], 'readwrite');

  const storingBatch = 1000
  let storedCount = 0;
  for (let i = 0; i < totalToStore; i += storingBatch) {
    try {
      const chunk = validData.slice(i, i + storingBatch);
      const tx = db.transaction([METADATA_STORE_NAME, IMAGE_FILES_STORE_NAME], 'readwrite')
      const meta = tx.objectStore(METADATA_STORE_NAME);
      const files = tx.objectStore(IMAGE_FILES_STORE_NAME);

      const perItemPromises = chunk.map(async ({ metadata, file }) => {
        try {
          const metadataId = await meta.add(metadata);
          await files.add(file, metadataId);
          storedCount++;
          onProgress?.(50 + (storedCount / totalToStore) * 50);
        } catch (e) {
          console.error(`Skipping file due to error during storage: ${file.name}`, e);
        }
      });

      await Promise.allSettled(perItemPromises);
      await tx.done; // commit point for this chunk
    } catch (e) {
      console.error(`Skipping file due to error during storage`, e);
    }
    // storedCount++;
    onProgressThrottled(50 + (storedCount / totalToStore) * 50); // Storing is the second 50%
  }

  await tx.done;
  onProgressThrottled(100);
}

export async function storeImages(files: File[], onProgress?: (progress: number) => void) {
  // Calculate incoming bytes
  const incomingBytes = files.reduce((sum, f) => sum + (f.size ?? 0), 0);

  // Optional: special copy for Firefox users
  const confirmPrompt = async () => {
    const msg = isFirefox()
      ? 'Firefox limits this site to ~10 GiB unless you allow persistent storage. Allow it so we can store more images?'
      : 'Allow persistent storage so we can store more images and reduce the chance of data eviction?';
    return window.confirm(msg);
  };

  const { info, canProceed } = await preflightQuotaOrPersist(incomingBytes, confirmPrompt);
  if (!canProceed) {
    const neededGiB = toGiB(incomingBytes);
    const freeGiB = toGiB(Math.max(0, info.quota - info.usage));
    throw new Error(
      `Not enough browser storage available.\n` +
      `Needed ~${neededGiB.toFixed(2)} GiB, free ~${freeGiB.toFixed(2)} GiB.\n` +
      `Tip: enable persistent storage and/or import fewer files at once.`
    );
  }

  await clearImages();
  await processAndStoreFiles(files, onProgress);
}

export async function addNewImages(files: File[], onProgress?: (progress: number) => void): Promise<number> {
  const existingMetadata = await getAllStoredImageMetadata();
  const existingPaths = new Set(existingMetadata.map(img => img.webkitRelativePath));
  const newFiles = files.filter(file => !existingPaths.has(file.webkitRelativePath));

  if (newFiles.length === 0) return 0;

  // Quota preflight for only the new files
  const incomingBytes = newFiles.reduce((sum, f) => sum + (f.size ?? 0), 0);

  const confirmPrompt = async () => {
    const msg = isFirefox()
      ? 'Firefox limits this site to ~10 GiB unless you allow persistent storage. Allow it so we can store more images?'
      : 'Allow persistent storage so we can store more images and reduce the chance of data eviction?';
    return window.confirm(msg);
  };

  const { info, canProceed } = await preflightQuotaOrPersist(incomingBytes, confirmPrompt);

  if (!canProceed) {
    const neededGiB = toGiB(incomingBytes);
    const freeGiB = toGiB(Math.max(0, info.quota - info.usage));
    throw new Error(
      `Not enough browser storage available for new images.\n` +
      `Needed ~${neededGiB.toFixed(2)} GiB, free ~${freeGiB.toFixed(2)} GiB.\n` +
      `Tip: enable persistent storage and/or import fewer files at once.`
    );
  }

  await processAndStoreFiles(newFiles, onProgress);
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
    db.clear(IMAGE_FILES_STORE_NAME),
    db.clear(DIRECTORY_HANDLE_STORE_NAME),
  ]);
}

// --- Directory Handle Management ---
const HANDLE_KEY = 'main_directory_handle';

export async function storeDirectoryHandle(handle: FileSystemDirectoryHandle) {
  const db = await getDb();
  await db.put(DIRECTORY_HANDLE_STORE_NAME, handle, HANDLE_KEY);
}

export async function getDirectoryHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  const db = await getDb();
  return db.get(DIRECTORY_HANDLE_STORE_NAME, HANDLE_KEY);
}

export async function clearDirectoryHandle() {
  const db = await getDb();
  await db.delete(DIRECTORY_HANDLE_STORE_NAME, HANDLE_KEY);
}