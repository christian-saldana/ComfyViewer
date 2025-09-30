"use client";

import { DBSchema, openDB } from 'idb';

const DB_NAME = 'comfy-viewer-db';
const METADATA_STORE_NAME = 'images';
const DB_VERSION = 14;

export interface Lora {
  name: string;
  strength_model: number | string;
  strength_clip: number | string;
}

// This is the object we'll work with in the application
export interface StoredImage {
  id: number;
  name: string;
  type: string;
  lastModified: number;
  webkitRelativePath: string;
  size: number;
  width: number | null;
  height: number | null;
  thumbnail: string;
  workflow: string | null;
  // Advanced metadata
  prompt: string | null;
  negativePrompt: string | null;
  seed: string | null;
  cfg: string | null;
  guidance: string | null;
  steps: string | null;
  sampler: string | null;
  scheduler: string | null;
  model: string | null;
  loras: Lora[];
  fullPath?: string;
  frameRate?: number;
  duration?: number;
}

// This interface defines the shape of the data we'll store in IndexedDB.
interface StorableMetadata {
  name: string;
  type: string;
  lastModified: number;
  webkitRelativePath: string;
  thumbnail: string;
  size: number;
  width: number | null;
  height: number | null;
  workflow: string | null;
  // Advanced metadata
  prompt: string | null;
  negativePrompt: string | null;
  seed: string | null;
  cfg: string | null;
  guidance: string | null;
  steps: string | null;
  sampler: string | null;
  scheduler: string | null;
  model: string | null;
  loras: Lora[];
  fullPath?: string;
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
}

async function getDb() {
  return openDB<MyDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Handle database upgrades sequentially.

      if (oldVersion < 14) {
        // This version introduced a breaking change to the 'loras' property.
        // We need to recreate the metadata and image file stores.
        // This will run for fresh installs and any version before 14.

        if (db.objectStoreNames.contains(METADATA_STORE_NAME)) {
          db.deleteObjectStore(METADATA_STORE_NAME);
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
      }
    },
  });
}

export async function storeMetadataOnly(metadataArray: StoredImage[], onProgress?: (progress: number) => void) {
  const db = await getDb();
  const tx = db.transaction(METADATA_STORE_NAME, 'readwrite');
  const store = tx.objectStore(METADATA_STORE_NAME);

  let storedCount = 0;
  const totalToStore = metadataArray.length;

  for (const metadata of metadataArray) {
    try {
      // The metadata object from the server might have an 'id' if we're not careful,
      // but it's safer to remove it to ensure IndexedDB's autoIncrement works correctly.
      const { id, ...storableMetadata } = metadata;
      await store.add(storableMetadata);
      storedCount++;
      onProgress?.((storedCount / totalToStore) * 100);
    } catch (e) {
      console.error(`Error storing metadata for ${metadata.name}:`, e);
    }
  }
  await tx.done;
  onProgress?.(100);
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

export async function clearImages() {
  const db = await getDb();
  // Clear both object stores
  await Promise.all([
    db.clear(METADATA_STORE_NAME),
  ]);
}

export async function clearAllData() {
  const db = await getDb();
  // Clear both object stores
  await Promise.all([
    db.clear(METADATA_STORE_NAME),
  ]);
}