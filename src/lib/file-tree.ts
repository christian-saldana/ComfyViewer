export interface FileTreeNode {
  name: string;
  path: string;
  children: FileTreeNode[];
}

export const buildFileTree = (files: File[]): FileTreeNode | null => {
  if (files.length === 0) {
    return null;
  }

  const rootPath = files[0].webkitRelativePath.split("/")[0];
  const root: FileTreeNode = { name: rootPath, path: rootPath, children: [] };
  const nodeMap = new Map<string, FileTreeNode>([
    [rootPath, root],
  ]);

  for (const file of files) {
    const pathParts = file.webkitRelativePath.split("/");
    let currentPath = "";
    let parentNode = root;

    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      let currentNode = nodeMap.get(currentPath);
      if (!currentNode) {
        currentNode = { name: part, path: currentPath, children: [] };
        nodeMap.set(currentPath, currentNode);
        parentNode.children.push(currentNode);
      }
      parentNode = currentNode;
    }
  }

  return root;
};