import { StoredImage } from "./image-db";

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  children: FileTreeNode[];
  lastModified: number;
  id?: number;
}

function postProcess(node: FileTreeNode) {
  if (node.type === 'file') {
    return;
  }

  // Recurse first to process children
  node.children.forEach(postProcess);

  // Update a folder's lastModified to be the maximum of its children's dates
  if (node.children.length > 0) {
    node.lastModified = Math.max(...node.children.map(c => c.lastModified));
  }

  // Sort children: folders before files, then by date descending
  node.children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    return b.lastModified - a.lastModified;
  });
}

export const buildFileTree = (files: StoredImage[]): FileTreeNode | null => {
  if (!files || files.length === 0) {
    return null;
  }

  // Create a virtual root. We will find the real root later.
  const virtualRoot: FileTreeNode = { name: 'virtual_root', path: '', type: 'folder', children: [], lastModified: 0 };

  for (const file of files) {
    // Normalize path separators and split
    const pathParts = file.webkitRelativePath.replace(/\\/g, '/').split('/');
    let currentNode = virtualRoot;

    // Walk or create the folder structure for the file
    // e.g., for path 'A/B/C.png', this loop runs for 'A' and 'B'
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!part) continue;

      let childNode = currentNode.children.find(c => c.name === part && c.type === 'folder');

      if (!childNode) {
        // If folder doesn't exist, create it
        const newPath = currentNode.path ? `${currentNode.path}/${part}` : part;
        childNode = { name: part, path: newPath, type: 'folder', children: [], lastModified: 0 };
        currentNode.children.push(childNode);
      }
      // Move down to the next level
      currentNode = childNode;
    }

    // Add the file node to its parent folder
    const fileName = pathParts[pathParts.length - 1];
    if (fileName) {
      currentNode.children.push({
        name: fileName,
        path: file.webkitRelativePath,
        type: 'file',
        children: [],
        lastModified: file.lastModified,
        id: file.id,
      });
    }
  }

  // The real root is likely the single folder inside our virtual root.
  if (virtualRoot.children.length === 1 && virtualRoot.children[0].type === 'folder') {
    const realRoot = virtualRoot.children[0];
    postProcess(realRoot);
    return realRoot;
  }

  // Fallback for multiple top-level folders or files (shouldn't happen with unified paths)
  // In this case, the virtual root becomes the real root.
  virtualRoot.name = 'root';
  virtualRoot.path = 'root';
  postProcess(virtualRoot);
  return virtualRoot;
};