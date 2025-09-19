// src/types/global.d.ts
interface Window {
    showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
}

interface DirectoryPickerOptions {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | FileSystemDirectoryHandle;
}

// These interfaces are also part of the File System Access API and are often missing too.
// You might need to add more as you use the API.
// A minimal set:
interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
    isSameEntry(other: FileSystemHandle): Promise<boolean>;
    queryPermission
    requestPermission
    values
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
    readonly kind: 'directory';
    // ... other methods like getDirectoryHandle, getFileHandle, values, etc.
}

interface FileSystemFileHandle extends FileSystemHandle {
    readonly kind: 'file';
    getFile(): Promise<File>;
}