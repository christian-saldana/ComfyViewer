"use client";

import * as React from "react";
import {
  Folder,
  PanelLeftClose,
  PanelRightClose,
  PanelLeftOpen,
  PanelRightOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  ImperativePanelHandle,
} from "@/components/ui/resizable";
import { ImageGallery } from "@/components/image-gallery";
import { MetadataViewer } from "@/components/metadata-viewer";
import { FileTree } from "@/components/file-tree";
import { buildFileTree, FileTreeNode } from "@/lib/file-tree";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export default function Home() {
  const [allFiles, setAllFiles] = React.useState<File[]>([]);
  const [filteredFiles, setFilteredFiles] = React.useState<File[]>([]);
  const [fileTree, setFileTree] = React.useState<FileTreeNode | null>(null);
  const [selectedPath, setSelectedPath] = React.useState<string>("");
  const [selectedImage, setSelectedImage] = React.useState<File | null>(null);
  const [viewSubfolders, setViewSubfolders] = React.useState(false);
  const [gridCols, setGridCols] = React.useState(4);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const leftPanelRef = React.useRef<ImperativePanelHandle>(null);
  const rightPanelRef = React.useRef<ImperativePanelHandle>(null);

  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] =
    React.useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] =
    React.useState(false);

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
      } else {
        setSelectedPath("");
      }
      setSelectedImage(null);
    }
  };

  const handleFolderSelect = (path: string) => {
    setSelectedPath(path);
  };

  const handleFolderSelectClick = () => {
    fileInputRef.current?.click();
  };

  const toggleLeftPanel = () => {
    const panel = leftPanelRef.current;
    if (panel) {
      panel.isCollapsed() ? panel.expand() : panel.collapse();
    }
  };

  const toggleRightPanel = () => {
    const panel = rightPanelRef.current;
    if (panel) {
      panel.isCollapsed() ? panel.expand() : panel.collapse();
    }
  };

  React.useEffect(() => {
    if (!selectedPath) {
      setFilteredFiles([]);
      return;
    }

    const newFilteredFiles = allFiles.filter((file) => {
      if (viewSubfolders) {
        return file.webkitRelativePath.startsWith(selectedPath);
      } else {
        const parentDirectory = file.webkitRelativePath.substring(
          0,
          file.webkitRelativePath.lastIndexOf("/")
        );
        return parentDirectory === selectedPath;
      }
    });

    setFilteredFiles(newFilteredFiles);
    setSelectedImage(null);
  }, [allFiles, selectedPath, viewSubfolders]);

  return (
    <div className="grid h-full grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between border-b p-4">
        <h1 className="text-xl font-bold">Image Viewer</h1>
        <div className="flex items-center gap-6">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="view-subfolders"
                    checked={viewSubfolders}
                    onCheckedChange={setViewSubfolders}
                  />
                  <Label
                    htmlFor="view-subfolders"
                    className="cursor-pointer whitespace-nowrap"
                  >
                    Include Subfolders
                  </Label>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  When enabled, shows images from all subfolders of the
                  selected folder.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex w-48 items-center gap-2">
            <Label htmlFor="grid-slider" className="whitespace-nowrap">
              Image Size
            </Label>
            <Slider
              id="grid-slider"
              min={1}
              max={12}
              step={1}
              value={[gridCols]}
              onValueChange={(value) => setGridCols(value[0])}
              className="w-full"
            />
          </div>
          <Button onClick={handleFolderSelectClick}>
            <Folder className="mr-2 h-4 w-4" />
            Select Folder
          </Button>
        </div>
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
        <ResizablePanel
          ref={leftPanelRef}
          defaultSize={20}
          minSize={15}
          collapsible
          collapsedSize={4}
          onCollapse={() => setIsLeftPanelCollapsed(true)}
          onExpand={() => setIsLeftPanelCollapsed(false)}
        >
          {!isLeftPanelCollapsed && (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b p-4">
                <h2 className="text-lg font-semibold">Folders</h2>
              </div>
              <ScrollArea className="flex-1">
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
            </div>
          )}
        </ResizablePanel>
        <ResizableHandle className="relative">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-1/2 top-16 z-10 h-7 w-7 -translate-x-1/2 -translate-y-1/2"
                  onClick={toggleLeftPanel}
                >
                  {isLeftPanelCollapsed ? (
                    <PanelRightOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{isLeftPanelCollapsed ? "Expand" : "Collapse"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </ResizableHandle>
        <ResizablePanel defaultSize={55}>
          <ImageGallery
            files={filteredFiles}
            selectedImage={selectedImage}
            onSelectImage={setSelectedImage}
            gridCols={gridCols}
          />
        </ResizablePanel>
        <ResizableHandle className="relative">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-1/2 top-16 z-10 h-7 w-7 -translate-x-1/2 -translate-y-1/2"
                  onClick={toggleRightPanel}
                >
                  {isRightPanelCollapsed ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelRightClose className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{isRightPanelCollapsed ? "Expand" : "Collapse"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </ResizableHandle>
        <ResizablePanel
          ref={rightPanelRef}
          defaultSize={25}
          minSize={15}
          collapsible
          collapsedSize={4}
          onCollapse={() => setIsRightPanelCollapsed(true)}
          onExpand={() => setIsRightPanelCollapsed(false)}
        >
          {!isRightPanelCollapsed && <MetadataViewer image={selectedImage} />}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}