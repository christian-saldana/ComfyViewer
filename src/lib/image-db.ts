"use client";

import { openDB, DBSchema } from 'idb';

const DB_NAME = 'image-viewer-db';
const STORE_NAME = 'images';
const DB_VERSION = 4;

// This interface defines the shape of the object we'll store in IndexedDB.
interface StorableFile {
  name: string;
  type: string;
  lastModified: number;
  webkitRelativePath: string;
  buffer: ArrayBuffer;
  thumbnail: string; // Will be an empty string
}

// This is the object we'll work with in the application
export interface StoredImage {
  file: File;
  thumbnail: string;
}

interface MyDB extends DBSchema {
  [STORE_NAME]: {
    key: number;
    value: StorableFile;
  };
}

async function getDb() {
  return openDB<MyDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 4) {
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        db.createObjectStore(STORE_NAME, { autoIncrement: true });
      }
    },
  });
}

export async function storeImages(files: File[], onProgress?: (progress: number) => void) {
  const db = await getDb();
  await db.clear(STORE_NAME); // Clear once at the beginning.

  const CHUNK_SIZE = 100; // Process files in chunks to avoid transaction issues
  let overallProcessedCount = 0;
  const totalFiles = files.length;

  for (let i = 0; i < totalFiles; i += CHUNK_SIZE) {
    const chunk = files.slice(i, i + CHUNK_SIZE);
    
    // 1. Prepare data for the chunk in parallel (just getting the buffer)
    const storableFilesChunk = await Promise.all(chunk.map(async (file) => {
      const buffer = await file.arrayBuffer();
      
      // Update progress
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
        thumbnail: '', // No thumbnail is generated
      };
    }));

    // 2. Write the prepared chunk in a single transaction
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await Promise.all([
      ...storableFilesChunk.map(sf => tx.store.put(sf)),
      tx.done,
    ]);
  }
}

export async function getStoredImages(): Promise<StoredImage[]> {
  const db = await getDb();
  const storableFiles = await db.getAll(STORE_NAME);

  return storableFiles.map(sf => {
    const file = new File([sf.buffer], sf.name, {
      type: sf.type,
      lastModified: sf.lastModified,
    });
    Object.defineProperty(file, 'webkitRelativePath', {
      value: sf.webkitRelativePath,
      writable: false,
    });
    return { file, thumbnail: sf.thumbnail };
  });
}

export async function clearImages() {
  const db = await getDb();
  await db.clear(STORE_NAME);
}