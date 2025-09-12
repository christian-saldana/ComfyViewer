"use client";

import { openDB, DBSchema } from 'idb';

const DB_NAME = 'image-viewer-db';
const STORE_NAME = 'images';
const DB_VERSION = 3; // Version is correct from last change

// This interface defines the shape of the object we'll store in IndexedDB.
interface StorableFile {
  name: string;
  type: string;
  lastModified: number;
  webkitRelativePath: string;
  buffer: ArrayBuffer;
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
      if (oldVersion < 3) {
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        db.createObjectStore(STORE_NAME, { autoIncrement: true });
      }
    },
  });
}

export async function storeImages(files: File[]) {
  // First, prepare all the data outside of the transaction.
  const storableFiles: StorableFile[] = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
      webkitRelativePath: file.webkitRelativePath,
      buffer: await file.arrayBuffer(),
    }))
  );

  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');

  // Now, perform all operations within the same transaction without awaiting them individually.
  // We use Promise.all to wait for all operations to complete together.
  await Promise.all([
    tx.store.clear(),
    ...storableFiles.map(sf => tx.store.put(sf)),
    tx.done, // This special promise resolves when the transaction is complete.
  ]);
}

export async function getStoredImages(): Promise<File[]> {
  const db = await getDb();
  const storableFiles = await db.getAll(STORE_NAME);

  // Reconstruct File objects from the stored plain objects.
  return storableFiles.map(sf => {
    const file = new File([sf.buffer], sf.name, {
      type: sf.type,
      lastModified: sf.lastModified,
    });
    // Manually re-attach the webkitRelativePath property.
    Object.defineProperty(file, 'webkitRelativePath', {
      value: sf.webkitRelativePath,
      writable: false,
    });
    return file;
  });
}

export async function clearImages() {
  const db = await getDb();
  await db.clear(STORE_NAME);
}