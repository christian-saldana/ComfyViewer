"use client";

import * as React from "react";
import { FileImage, Folder, FolderOpen } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FileTreeNode } from "@/lib/file-tree";
import { cn } from "@/lib/utils";

interface FileTreeProps {
  tree: FileTreeNode;
  selectedPath: string;
  onSelectPath: (path: string) => void;
  selectedImageId: number | null;
  onSelectFile: (id: number) => void;
}

export function FileTree({ tree, selectedPath, onSelectPath, selectedImageId, onSelectFile }: FileTreeProps) {
  return (
    <div className="p-2">
      <RecursiveTree
        node={tree}
        selectedPath={selectedPath}
        onSelectPath={onSelectPath}
        selectedImageId={selectedImageId}
        onSelectFile={onSelectFile}
      />
    </div>
  );
}

interface RecursiveTreeProps {
  node: FileTreeNode;
  selectedPath: string;
  onSelectPath: (path: string) => void;
  selectedImageId: number | null;
  onSelectFile: (id: number) => void;
}

function RecursiveTree({
  node,
  selectedPath,
  onSelectPath,
  selectedImageId,
  onSelectFile,
}: RecursiveTreeProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const isFolderSelected = selectedPath === node.path;
  const isParentOfSelected = selectedPath.startsWith(`${node.path}/`);

  React.useEffect(() => {
    if (isParentOfSelected) {
      setIsOpen(true);
    }
  }, [selectedPath, isParentOfSelected]);

  if (node.type === 'file') {
    const isFileSelected = selectedImageId === node.id;
    return (
      <div
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium",
          "hover:bg-accent",
          isFileSelected && "bg-primary/10 text-primary"
        )}
        onClick={() => onSelectFile(node.id!)}
      >
        <FileImage className="h-4 w-4" />
        <span>{node.name}</span>
      </div>
    );
  }

  // If the folder has no children, render it as a simple, non-collapsible item.
  if (node.children.length === 0) {
    return (
      <div
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium",
          "hover:bg-accent",
          isFolderSelected && "bg-primary/10 text-primary"
        )}
        onClick={() => onSelectPath(node.path)}
      >
        <Folder className="h-4 w-4" />
        <span>{node.name}</span>
      </div>
    );
  }

  // If the folder has children, render it as a collapsible item.
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium",
          "hover:bg-accent",
          isFolderSelected && "bg-primary/10 text-primary"
        )}
        onClick={() => onSelectPath(node.path)}
      >
        {isOpen ? (
          <FolderOpen className="h-4 w-4" />
        ) : (
          <Folder className="h-4 w-4" />
        )}
        <span>{node.name}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4">
        {node.children.map((child) => (
          <RecursiveTree
            key={child.path}
            node={child}
            selectedPath={selectedPath}
            onSelectPath={onSelectPath}
            selectedImageId={selectedImageId}
            onSelectFile={onSelectFile}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}