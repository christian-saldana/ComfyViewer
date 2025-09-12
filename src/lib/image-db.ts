"use client";

import { openDB, DBSchema } from 'idb';

const DB_NAME = 'image-viewer-db';
const STORE_NAME = 'images';
const DB_VERSION = 4; // Version is correct from last change

const THUMBNAIL_MAX_WIDTH = 256;
const THUMBNAIL_MAX_HEIGHT = 256;

// Helper function to generate a thumbnail from a File object
async function generateThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }

        let { width, height } = img;
        if (width > height) {
          if (width > THUMBNAIL_MAX_WIDTH) {
            height *= THUMBNAIL_MAX_WIDTH / width;
            width = THUMBNAIL_MAX_WIDTH;
          }
        } else {
          if (height > THUMBNAIL_MAX_HEIGHT) {
            width *= THUMBNAIL_MAX_HEIGHT / height;
            height = THUMBNAIL_MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8)); // Use JPEG for smaller size
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// This interface defines the shape of the object we'll store in IndexedDB.
interface StorableFile {
  name: string;
  type: string;
  lastModified: number;
  webkitRelativePath: string;
  buffer: ArrayBuffer;
  thumbnail: string; // Added thumbnail as a data URL
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
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  await store.clear();

  let processedCount = 0;
  const totalFiles = files.length;

  for (const file of files) {
    const [thumbnail, buffer] = await Promise.all([
      generateThumbnail(file),
      file.arrayBuffer(),
    ]);

    const storableFile: StorableFile = {
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      webkitRelativePath: file.webkitRelativePath,
      buffer,
      thumbnail,
    };

    await store.put(storableFile);

    processedCount++;
    if (onProgress) {
      onProgress((processedCount / totalFiles) * 100);
    }
  }

  await tx.done;
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