"use client";

import { openDB, DBSchema } from 'idb';

const DB_NAME = 'image-viewer-db';
const STORE_NAME = 'images';
const DB_VERSION = 7; // Version bump for schema change
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

// This interface defines the shape of the metadata we'll store in IndexedDB.
// The actual file buffer is no longer stored here.
interface StorableMetadata {
  name: string;
  type: string;
  lastModified: number;
  webkitRelativePath: string;
  thumbnail: string;
  size: number;
}

interface MyDB extends DBSchema {
  [STORE_NAME]: {
    key: number;
    value: StorableMetadata;
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
      if (oldVersion < 7) {
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
  // First, clear out any old data from all storage systems
  await clearImages();

  const db = await getDb();
  const root = await navigator.storage.getDirectory();
  
  let processedCount = 0;
  const totalFiles = files.length;

  const tx = db.transaction(STORE_NAME, 'readwrite');
  for (const file of files) {
    // Write the actual file to the Origin Private File System
    const fileHandle = await root.getFileHandle(file.name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();

    // Prepare the metadata object for IndexedDB
    const metadata: StorableMetadata = {
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      webkitRelativePath: file.webkitRelativePath,
      thumbnail: '', // This field is currently unused
      size: file.size,
    };

    // Add the metadata to our IndexedDB transaction
    await tx.store.add(metadata);

    processedCount++;
    if (onProgress) {
      onProgress((processedCount / totalFiles) * 100);
    }
  }
  await tx.done;

  // Cache the relative paths in localStorage for quick access
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
  let itemsAdded = 0;

  let cursor = await index.openCursor(null, direction);

  while (cursor) {
    const path = cursor.value.webkitRelativePath;
    const parentDirectory = path.substring(0, path.lastIndexOf("/"));
    const shouldInclude = viewSubfolders
      ? path.startsWith(filterPath)
      : parentDirectory === filterPath;

    if (shouldInclude) {
      if (totalCount >= offset && itemsAdded < itemsPerPage) {
        images.push({ ...cursor.value, id: cursor.primaryKey });
        itemsAdded++;
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
  const metadata = await db.get(STORE_NAME, id);
  if (!metadata) return null;

  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(metadata.name);
    const file = await fileHandle.getFile();
    
    // The File object from OPFS doesn't include the relative path, so we re-attach it from our metadata.
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
  // Clear IndexedDB
  const db = await getDb();
  await db.clear(STORE_NAME);
  
  // Clear localStorage cache
  localStorage.removeItem(PATHS_STORAGE_KEY);

  // Clear all files from the Origin Private File System for this site
  try {
    const root = await navigator.storage.getDirectory();
    for await (const key of root.keys()) {
      await root.removeEntry(key);
    }
  } catch (e) {
    console.error("Failed to clear Origin Private File System:", e);
  }
}