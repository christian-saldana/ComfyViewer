"use client";

import * as React from "react";
import { Folder, Image as ImageIcon, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ImageGallery } from "@/components/image-gallery";
import { MetadataViewer } from "@/components/metadata-viewer";

export default function Home() {
  const [files, setFiles] = React.useState<File[]>([]);
  const [selectedImage, setSelectedImage] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const selectedFiles = Array.from(event.target.files);
      const imageFiles = selectedFiles.filter((file) =>
        file.type.startsWith("image/")
      );
      setFiles(imageFiles);
      setSelectedImage(null); // Reset selected image when new folder is chosen
    }
  };

  const handleFolderSelectClick = () => {
    fileInputRef.current?.click();
  };

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
        <ResizablePanel defaultSize={75}>
          <ImageGallery
            files={files}
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