"use client";

import { openDB, DBSchema } from 'idb';
import { getMetadata } from 'meta-png';

const DB_NAME = 'image-viewer-db';
const STORE_NAME = 'images';
const DB_VERSION = 8; // Version bump for schema change
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
  workflow: string | null;
}

// This interface defines the shape of the metadata we'll store in IndexedDB.
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
      if (oldVersion < 8) {
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
  filterQuery?: string;
}

export interface PaginatedImageResponse {
  images: StoredImage[];
  totalCount: number;
}

export async function getPaginatedImages(params: GetImagesParams): Promise<PaginatedImageResponse> {
  const { page, itemsPerPage, sortBy, sortOrder, filterPath, viewSubfolders, filterQuery } = params;
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
  const lowerCaseQuery = filterQuery?.toLowerCase();

  let cursor = await index.openCursor(null, direction);

  while (cursor) {
    const { webkitRelativePath, name, workflow } = cursor.value;
    const parentDirectory = webkitRelativePath.substring(0, webkitRelativePath.lastIndexOf("/"));
    const shouldIncludeByPath = viewSubfolders
      ? webkitRelativePath.startsWith(filterPath)
      : parentDirectory === filterPath;

    let shouldIncludeByFilter = true;
    if (lowerCaseQuery) {
      const nameMatch = name.toLowerCase().includes(lowerCaseQuery);
      const workflowMatch = workflow ? workflow.toLowerCase().includes(lowerCaseQuery) : false;
      shouldIncludeByFilter = nameMatch || workflowMatch;
    }

    if (shouldIncludeByPath && shouldIncludeByFilter) {
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

  localStorage.removeItem(PATHS_STORAGE_KEY);

  try {
    const root = await navigator.storage.getDirectory();
    for await (const key of root.keys()) {
      await root.removeEntry(key);
    }
  } catch (e) {
    console.error("Failed to clear Origin Private File System:", e);
  }
}