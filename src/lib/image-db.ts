"use client";

import { openDB, DBSchema } from 'idb';

const DB_NAME = 'image-viewer-db';
const STORE_NAME = 'images';
const DB_VERSION = 1;

interface MyDB extends DBSchema {
  [STORE_NAME]: {
    key: string; // webkitRelativePath will be the key
    value: File;
  };
}

async function getDb() {
  return openDB<MyDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Use webkitRelativePath as the keyPath, as it's unique for each file in a directory.
        db.createObjectStore(STORE_NAME, { keyPath: 'webkitRelativePath' });
      }
    },
  });
}

export async function storeImages(files: File[]) {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  // Clear existing images before adding new ones to ensure a fresh state.
  await tx.store.clear();
  // Use Promise.all to add all files in a single transaction.
  await Promise.all(files.map(file => tx.store.put(file)));
  await tx.done;
}

export async function getStoredImages(): Promise<File[]> {
  const db = await getDb();
  return db.getAll(STORE_NAME);
}

export async function clearImages() {
  const db = await getDb();
  await db.clear(STORE_NAME);
}