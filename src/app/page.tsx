"use client";

import * as React from "react";
import { Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ImageGallery } from "@/components/image-gallery";
import { MetadataViewer } from "@/components/metadata-viewer";
import { FileTree } from "@/components/file-tree";
import { buildFileTree, FileTreeNode } from "@/lib/file-tree";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Home() {
  const [allFiles, setAllFiles] = React.useState<File[]>([]);
  const [filteredFiles, setFilteredFiles] = React.useState<File[]>([]);
  const [fileTree, setFileTree] = React.useState<FileTreeNode | null>(null);
  const [selectedPath, setSelectedPath] = React.useState<string>("");
  const [selectedImage, setSelectedImage] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const selectedFiles = Array.from(event.target.files);
      const imageFiles = selectedFiles.filter((file) =>
        file.type.startsWith("image/")
      );
      setAllFiles(imageFiles);

      const tree = buildFileTree(imageFiles);
      setFileTree(tree);

      if (tree) {
        setSelectedPath(tree.path);
        // Initially, show all images from the root folder and its subfolders
        setFilteredFiles(imageFiles);
      } else {
        setSelectedPath("");
        setFilteredFiles([]);
      }
      setSelectedImage(null);
    }
  };

  const handleFolderSelect = (path: string) => {
    setSelectedPath(path);
    const newFilteredFiles = allFiles.filter((file) => {
      // A file is in the selected folder if its parent directory path is exactly the selected path.
      const parentDirectory = file.webkitRelativePath.substring(
        0,
        file.webkitRelativePath.lastIndexOf("/")
      );
      return parentDirectory === path;
    });
    setFilteredFiles(newFilteredFiles);
    setSelectedImage(null);
  };

  const handleFolderSelectClick = () => {
    fileInputRef.current?.click();
  };

  // When the file tree is first built, select the root and show only its direct images
  React.useEffect(() => {
    if (fileTree) {
      handleFolderSelect(fileTree.path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileTree]);

  return (
    <div className="grid h-full grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between border-b p-4">
        <h1 className="text-xl font-bold">Image Viewer</h1>
        <Button onClick={handleFolderSelectClick}>
          <Folder className="mr-2 h-4 w-4" />
          Select Folder
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          // @ts-ignore
          webkitdirectory="true"
          directory="true"
        />
      </header>

      <ResizablePanelGroup direction="horizontal" className="w-full">
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <ScrollArea className="h-full">
            {fileTree ? (
              <FileTree
                tree={fileTree}
                selectedPath={selectedPath}
                onSelectPath={handleFolderSelect}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
                Select a folder to view its structure.
              </div>
            )}
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={55}>
          <ImageGallery
            files={filteredFiles}
            selectedImage={selectedImage}
            onSelectImage={setSelectedImage}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
          <MetadataViewer image={selectedImage} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}