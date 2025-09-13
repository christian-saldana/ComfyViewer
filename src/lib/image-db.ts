"use client";

import { openDB, DBSchema } from 'idb';

const DB_NAME = 'image-viewer-db';
const STORE_NAME = 'images';
const DB_VERSION = 6; // Incremented version for new indexes
const PATHS_STORAGE_KEY = 'image-viewer-paths';

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
    indexes: {
      'by-path': string;
      'by-lastModified': number;
      'by-size': number;
    };
  };
}

async function getDb() {
  return openDB<MyDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 6) {
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('by-path', 'webkitRelativePath');
        store.createIndex('by-lastModified', 'lastModified');
        store.createIndex('by-size', 'size');
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
      ...storableFilesChunk.map(sf => tx.store.put(sf as any)),
      tx.done,
    ]);
  }

  const paths = files.map(file => ({ webkitRelativePath: file.webkitRelativePath }));
  localStorage.setItem(PATHS_STORAGE_KEY, JSON.stringify(paths));
}

export interface GetImagesParams {
  page: number;
  itemsPerPage: number;
  sortBy: 'lastModified' | 'size';
  sortOrder: 'asc' | 'desc';
  filterPath: string;
  viewSubfolders: boolean;
}

export interface PaginatedImageResponse {
  images: StoredImage[];
  totalCount: number;
}

export async function getPaginatedImages(params: GetImagesParams): Promise<PaginatedImageResponse> {
  const { page, itemsPerPage, sortBy, sortOrder, filterPath, viewSubfolders } = params;
  if (!filterPath) {
    return { images: [], totalCount: 0 };
  }

  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.store;

  const indexName = sortBy === 'lastModified' ? 'by-lastModified' : 'by-size';
  const direction = sortOrder === 'asc' ? 'next' : 'prev';
  const index = store.index(indexName);

  const images: StoredImage[] = [];
  let totalCount = 0;
  const offset = (page - 1) * itemsPerPage;

  let cursor = await index.openCursor(null, direction);

  while (cursor) {
    const path = cursor.value.webkitRelativePath;
    const parentDirectory = path.substring(0, path.lastIndexOf("/"));
    const shouldInclude = viewSubfolders
      ? path.startsWith(filterPath)
      : parentDirectory === filterPath;

    if (shouldInclude) {
      if (totalCount >= offset && images.length < itemsPerPage) {
        const { buffer, ...metadata } = cursor.value;
        images.push({ ...metadata, id: cursor.primaryKey });
      }
      totalCount++;
    }
    cursor = await cursor.continue();
  }

  return { images, totalCount };
}

export function getStoredImagePaths(): { webkitRelativePath: string }[] {
    const storedPaths = localStorage.getItem(PATHS_STORAGE_KEY);
    if (storedPaths) {
        try {
            return JSON.parse(storedPaths);
        } catch (e) {
            console.error("Failed to parse stored paths from localStorage", e);
            return [];
        }
    }
    return [];
}

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
  localStorage.removeItem(PATHS_STORAGE_KEY);
}