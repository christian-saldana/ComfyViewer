"use client";

import { openDB, DBSchema } from 'idb';

const DB_NAME = 'image-viewer-db';
const STORE_NAME = 'images';
const DB_VERSION = 5; // Incremented version

// This is the object we'll work with in the application
export interface StoredImage {
  id: number;
  name: string;
  type: string;
  lastModified: number;
  webkitRelativePath: string;
  size: number;
  thumbnail: string;
}

// This interface defines the shape of the object we'll store in IndexedDB.
interface StorableFile {
  name: string;
  type: string;
  lastModified: number;
  webkitRelativePath: string;
  buffer: ArrayBuffer;
  thumbnail: string;
  size: number;
}

interface MyDB extends DBSchema {
  [STORE_NAME]: {
    key: number;
    value: StorableFile;
    indexes: { 'by-path': string };
  };
}

async function getDb() {
  return openDB<MyDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 5) {
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('by-path', 'webkitRelativePath');
      }
    },
  });
}

export async function storeImages(files: File[], onProgress?: (progress: number) => void) {
  const db = await getDb();
  await db.clear(STORE_NAME);

  const CHUNK_SIZE = 100;
  let overallProcessedCount = 0;
  const totalFiles = files.length;

  for (let i = 0; i < totalFiles; i += CHUNK_SIZE) {
    const chunk = files.slice(i, i + CHUNK_SIZE);

    const storableFilesChunk = await Promise.all(chunk.map(async (file) => {
      const buffer = await file.arrayBuffer();
      overallProcessedCount++;
      if (onProgress) {
        onProgress((overallProcessedCount / totalFiles) * 100);
      }
      return {
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        webkitRelativePath: file.webkitRelativePath,
        buffer,
        thumbnail: '',
        size: file.size,
      };
    }));

    const tx = db.transaction(STORE_NAME, 'readwrite');
    await Promise.all([
      ...storableFilesChunk.map(sf => tx.store.put(sf as any)), // `id` is auto-incremented
      tx.done,
    ]);
  }
}

// Gets only the metadata, not the heavy buffer
export async function getStoredImages(): Promise<StoredImage[]> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const images: StoredImage[] = [];
  let cursor = await tx.store.openCursor();
  while (cursor) {
    const { buffer, ...metadata } = cursor.value;
    images.push({ ...metadata, id: cursor.primaryKey });
    cursor = await cursor.continue();
  }
  return images;
}

// Gets a single full image file by its ID
export async function getStoredImageFile(id: number): Promise<File | null> {
  const db = await getDb();
  const storableFile = await db.get(STORE_NAME, id);
  if (!storableFile) return null;

  const file = new File([storableFile.buffer], storableFile.name, {
    type: storableFile.type,
    lastModified: storableFile.lastModified,
  });
  Object.defineProperty(file, 'webkitRelativePath', {
    value: storableFile.webkitRelativePath,
    writable: false,
  });
  return file;
}

export async function clearImages() {
  const db = await getDb();
  await db.clear(STORE_NAME);
}