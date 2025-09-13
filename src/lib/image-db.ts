"use client";

import { openDB, DBSchema } from 'idb';
import { getMetadata } from 'meta-png';

const DB_NAME = 'image-viewer-db';
const STORE_NAME = 'images';
const DB_VERSION = 9;

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
    };
  };
}

async function getDb() {
  return openDB<MyDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 9) {
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('by-path', 'webkitRelativePath');
        store.createIndex('by-lastModified', 'lastModified');
        store.createIndex('by-size', 'size');
        store.createIndex('by-name', 'name');
        store.createIndex('by-workflow', 'workflow');
      }
    },
  });
}

export async function storeImages(files: File[], onProgress?: (progress: number) => void) {
  await clearImages();

  const db = await getDb();
  const root = await navigator.storage.getDirectory();

  let processedCount = 0;
  const totalFiles = files.length;
  const CHUNK_SIZE = 100;

  for (let i = 0; i < totalFiles; i += CHUNK_SIZE) {
    const chunk = files.slice(i, i + CHUNK_SIZE);
    const metadataChunk: StorableMetadata[] = [];

    for (const file of chunk) {
      const fileHandle = await root.getFileHandle(file.name, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(file);
      await writable.close();

      let workflow: string | null = null;
      if (file.type === 'image/png') {
        try {
          const buffer = await file.arrayBuffer();
          const pngBytes = new Uint8Array(buffer);
          workflow = getMetadata(pngBytes, "workflow") || getMetadata(pngBytes, "prompt") || null;
        } catch (e) {
          console.warn(`Could not parse metadata for ${file.name}:`, e);
        }
      }

      metadataChunk.push({
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        webkitRelativePath: file.webkitRelativePath,
        thumbnail: '',
        size: file.size,
        workflow: workflow,
      });

      processedCount++;
      if (onProgress) {
        onProgress((processedCount / totalFiles) * 100);
      }
    }

    const tx = db.transaction(STORE_NAME, 'readwrite');
    await Promise.all([
      ...metadataChunk.map(metadata => tx.store.add(metadata)),
      tx.done
    ]);
  }
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
    const fileHandle = await root.getFileHandle(metadata.name);
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
    for await (const key of root.keys()) {
      await root.removeEntry(key);
    }
  } catch (e) {
    console.error("Failed to clear Origin Private File System:", e);
  }
}