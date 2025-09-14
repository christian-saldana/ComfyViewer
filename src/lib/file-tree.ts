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
  if (!files || files.length === 0 || !files[0].webkitRelativePath) {
    return null;
  }

  const rootPath = files[0].webkitRelativePath.split('/')[0];
  const root: FileTreeNode = { name: rootPath, path: rootPath, type: 'folder', children: [], lastModified: 0 };
  const nodeMap = new Map<string, FileTreeNode>([[rootPath, root]]);

  // First, create all necessary folder nodes
  for (const file of files) {
    const pathParts = file.webkitRelativePath.split('/');
    let currentPath = '';
    let parentNode = root;

    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      let currentNode = nodeMap.get(currentPath);
      if (!currentNode) {
        currentNode = { name: part, path: currentPath, type: 'folder', children: [], lastModified: 0 };
        nodeMap.set(currentPath, currentNode);
        parentNode.children.push(currentNode);
      }
      parentNode = currentNode;
    }
  }

  // Next, add all file nodes to their respective parent folders
  for (const file of files) {
    const parentPath = file.webkitRelativePath.substring(0, file.webkitRelativePath.lastIndexOf('/'));
    const parentNode = nodeMap.get(parentPath);
    if (parentNode) {
      parentNode.children.push({
        
        name: file.name,
        path: file.webkitRelativePath,
        type: 'file',
        children: [],
        lastModified: file.lastModified,
        id: file.id,
      });
    }
  }

  // Finally, post-process the entire tree to sort and update dates
  postProcess(root);

  return root;
};