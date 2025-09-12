"use client";

import * as React from "react";
import {
  Folder,
  PanelLeftClose,
  PanelRightClose,
  PanelLeftOpen,
  PanelRightOpen,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  Trash2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocalStorage } from "@/hooks/use-local-storage"; // Import the hook

type SortBy = "lastModified" | "size";
type SortOrder = "asc" | "desc";

// Define a storable image type
interface StoredImage {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  dataURL: string;
  webkitRelativePath: string;
}

export default function Home() {
  const [allFiles, setAllFiles] = React.useState<File[]>([]);
  const [filteredFiles, setFilteredFiles] = React.useState<File[]>([]);
  const [fileTree, setFileTree] = React.useState<FileTreeNode | null>(null);
  const [selectedPath, setSelectedPath] = React.useState<string>("");
  const [selectedImage, setSelectedImage] = React.useState<File | null>(null);
  const [viewSubfolders, setViewSubfolders] = React.useState(false);
  const [gridCols, setGridCols] = React.useState(4);
  const [sortBy, setSortBy] = React.useState<SortBy>("lastModified");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("desc");

  // Use localStorage to persist images
  const [storedImages, setStoredImages] = useLocalStorage<StoredImage[]>(
    "imageViewerFiles",
    []
  );

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const leftPanelRef = React.useRef<ImperativePanelHandle>(null);
  const rightPanelRef = React.useRef<ImperativePanelHandle>(null);

  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] =
    React.useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] =
    React.useState(false);

  const MIN_COLS = 1;
  const MAX_COLS = 12;

  // Load images from local storage on initial mount
  React.useEffect(() => {
    if (storedImages.length > 0) {
      const loadedFiles = storedImages.map((stored) => {
        const byteString = atob(stored.dataURL.split(",")[1]);
        const mimeString = stored.dataURL.split(",")[0].split(":")[1].split(";")[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const file = new File([ab], stored.name, { type: mimeString, lastModified: stored.lastModified });
        // Manually assign webkitRelativePath as it's not part of File constructor
        Object.defineProperty(file, 'webkitRelativePath', {
          value: stored.webkitRelativePath,
          writable: false
        });
        return file;
      });
      setAllFiles(loadedFiles);
      const tree = buildFileTree(loadedFiles);
      setFileTree(tree);
      if (tree) {
        setSelectedPath(tree.path);
      }
    }
  }, []); // Run only once on mount

  const handleSliderChange = (value: number[]) => {
    const newGridCols = MAX_COLS + MIN_COLS - value[0];
    setGridCols(newGridCols);
  };

  const sliderValue = MAX_COLS + MIN_COLS - gridCols;

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files) {
      const selectedFiles = Array.from(event.target.files);
      const imageFiles = selectedFiles.filter((file) =>
        file.type.startsWith("image/")
      );

      const storableImages: StoredImage[] = await Promise.all(
        imageFiles.map(async (file) => {
          const dataURL = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          return {
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified,
            dataURL,
            webkitRelativePath: file.webkitRelativePath,
          };
        })
      );

      setStoredImages(storableImages); // Save to local storage
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

  const handleClearImages = () => {
    setAllFiles([]);
    setFilteredFiles([]);
    setFileTree(null);
    setSelectedPath("");
    setSelectedImage(null);
    setStoredImages([]); // Clear from local storage
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

    let newFilteredFiles = allFiles.filter((file) => {
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

    // Apply sorting
    newFilteredFiles.sort((a, b) => {
      let compareValue = 0;
      if (sortBy === "lastModified") {
        compareValue = a.lastModified - b.lastModified;
      } else if (sortBy === "size") {
        compareValue = a.size - b.size;
      }

      return sortOrder === "asc" ? compareValue : -compareValue;
    });

    setFilteredFiles(newFilteredFiles);
    setSelectedImage(null);
  }, [allFiles, selectedPath, viewSubfolders, sortBy, sortOrder]);

  return (
    <div className="grid h-full grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between border-b p-4">
        <h1 className="text-xl font-bold">Image Viewer</h1>
        <div className="flex items-center gap-6">
          <div className="flex w-48 items-center gap-2">
            <Label htmlFor="grid-slider" className="whitespace-nowrap">
              Image Size
            </Label>
            <Slider
              id="grid-slider"
              min={MIN_COLS}
              max={MAX_COLS}
              step={1}
              value={[sliderValue]}
              onValueChange={handleSliderChange}
              className="w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="sort-by" className="whitespace-nowrap">
              Sort By:
            </Label>
            <Select
              value={sortBy}
              onValueChange={(value: SortBy) => setSortBy(value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lastModified">Last Modified</SelectItem>
                <SelectItem value="size">File Size</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            >
              {sortOrder === "asc" ? (
                <ArrowUpNarrowWide className="h-4 w-4" />
              ) : (
                <ArrowDownWideNarrow className="h-4 w-4" />
              )}
            </Button>
          </div>
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
          minSize={4}
          collapsible
          collapsedSize={4}
          onCollapse={() => setIsLeftPanelCollapsed(true)}
          onExpand={() => setIsLeftPanelCollapsed(false)}
        >
          {!isLeftPanelCollapsed && (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b p-4">
                <h2 className="text-lg font-semibold">Folders</h2>
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={handleFolderSelectClick} size="icon" variant="outline">
                          <Folder className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Select Folder</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={handleClearImages} size="icon" variant="outline">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Clear Images</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
                            className="cursor-pointer whitespace-nowrap sr-only"
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
                </div>
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
        <ResizableHandle className="relative flex w-2 items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 after:bg-primary after:opacity-0 after:transition-opacity hover:after:opacity-100">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-1/2 top-1/2 z-10 h-7 w-7 -translate-x-1/2 -translate-y-1/2"
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
        <ResizableHandle className="relative flex w-2 items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 after:bg-primary after:opacity-0 after:transition-opacity hover:after:opacity-100">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-1/2 top-1/2 z-10 h-7 w-7 -translate-x-1/2 -translate-y-1/2"
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
          minSize={4}
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