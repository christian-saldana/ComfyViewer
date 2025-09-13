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
import { storeImages, clearImages, StoredImage, getStoredImageFile, getPaginatedImages, getStoredImagePaths } from "@/lib/image-db";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

type SortBy = "lastModified" | "size";
type SortOrder = "asc" | "desc";

const ITEMS_PER_PAGE_OPTIONS = [12, 24, 48, 96, 200];
const ITEMS_PER_PAGE_KEY = "image-viewer-items-per-page";

export default function Home() {
  const [allPaths, setAllPaths] = React.useState<{ webkitRelativePath: string }[]>([]);
  const [paginatedFiles, setPaginatedFiles] = React.useState<StoredImage[]>([]);
  const [totalImageCount, setTotalImageCount] = React.useState(0);

  const [selectedPath, setSelectedPath] = React.useState<string>("");
  const [selectedImageId, setSelectedImageId] = React.useState<number | null>(null);
  const [selectedImageFile, setSelectedImageFile] = React.useState<File | null>(null);
  const [viewSubfolders, setViewSubfolders] = React.useState(false);
  const [gridCols, setGridCols] = React.useState(4);
  const [sortBy, setSortBy] = React.useState<SortBy>("lastModified");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const [itemsPerPage, setItemsPerPage] = React.useState(ITEMS_PER_PAGE_OPTIONS[1]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const leftPanelRef = React.useRef<ImperativePanelHandle>(null);
  const rightPanelRef = React.useRef<ImperativePanelHandle>(null);

  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = React.useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = React.useState(false);

  const MIN_COLS = 1;
  const MAX_COLS = 12;

  React.useEffect(() => {
    const storedItemsPerPage = localStorage.getItem(ITEMS_PER_PAGE_KEY);
    if (storedItemsPerPage) {
      const parsedValue = parseInt(storedItemsPerPage, 10);
      if (ITEMS_PER_PAGE_OPTIONS.includes(parsedValue)) {
        setItemsPerPage(parsedValue);
      }
    }
  }, []);

  React.useEffect(() => {
    localStorage.setItem(ITEMS_PER_PAGE_KEY, String(itemsPerPage));
  }, [itemsPerPage]);

  const fileTree = React.useMemo(() => {
    return buildFileTree(allPaths as File[]);
  }, [allPaths]);

  const fetchPaginatedData = React.useCallback(async (path: string, page: number) => {
    if (!path) return;

    setIsLoading(true);
    console.log('here')
    const response = await getPaginatedImages({
      page,
      itemsPerPage,
      sortBy,
      sortOrder,
      filterPath: path,
      viewSubfolders,
    });
    console.log('here2')

    setPaginatedFiles(response.images);
    setTotalImageCount(response.totalCount);
    const newTotalPages = Math.ceil(response.totalCount / itemsPerPage);
    if (page > newTotalPages && newTotalPages > 0) {
      setCurrentPage(newTotalPages);
    }
    setIsLoading(false);
  }, [itemsPerPage, sortBy, sortOrder, viewSubfolders]);

  React.useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);
      const paths = getStoredImagePaths();
      setAllPaths(paths);

      if (paths.length > 0) {
        const tree = buildFileTree(paths as any);
        const initialPath = tree ? tree.path : "";
        setSelectedPath(initialPath);
        await fetchPaginatedData(initialPath, 1);
      }
      setIsLoading(false);
    }
    loadInitialData();
  }, [fetchPaginatedData]);

  React.useEffect(() => {
    if (selectedPath) {
      fetchPaginatedData(selectedPath, currentPage);
    }
  }, [currentPage, fetchPaginatedData, selectedPath]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedPath, viewSubfolders, sortBy, sortOrder, itemsPerPage]);

  React.useEffect(() => {
    if (selectedImageId === null) {
      setSelectedImageFile(null);
      return;
    }
    let isCancelled = false;
    async function fetchFile() {
      const file = await getStoredImageFile(selectedImageId!);
      if (!isCancelled) {
        setSelectedImageFile(file);
      }
    }
    fetchFile();
    return () => { isCancelled = true; };
  }, [selectedImageId]);

  const totalPages = Math.ceil(totalImageCount / itemsPerPage);

  const handleSliderChange = (value: number[]) => {
    const newGridCols = MAX_COLS + MIN_COLS - value[0];
    setGridCols(newGridCols);
  };

  const sliderValue = MAX_COLS + MIN_COLS - gridCols;

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const selectedFiles = Array.from(event.target.files);
      const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/"));

      setIsLoading(true);
      setProgress(0);
      await storeImages(imageFiles, (p) => setProgress(p));

      const paths = getStoredImagePaths();
      setAllPaths(paths);
      setSelectedImageId(null);

      const newTree = buildFileTree(imageFiles);
      const newPath = newTree ? newTree.path : "";
      setSelectedPath(newPath);

      setCurrentPage(1);
      await fetchPaginatedData(newPath, 1);

      setIsLoading(false);
    }
  };

  const handleClearImages = async () => {
    await clearImages();
    setAllPaths([]);
    setPaginatedFiles([]);
    setTotalImageCount(0);
    setSelectedPath("");
    setSelectedImageId(null);
    setCurrentPage(1);
  };

  const handleFolderSelect = (path: string) => {
    setSelectedPath(path);
    setSelectedImageId(null);
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

  return (
    <div className="grid h-full grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Image Viewer</h1>
          {isLoading && (
            <div className="flex w-48 items-center gap-2">
              <Progress value={progress} className="w-full" />
              <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
            </div>
          )}
        </div>
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
                        <Button onClick={handleFolderSelectClick} size="icon" variant="outline" disabled={isLoading}>
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
                        <Button onClick={handleClearImages} size="icon" variant="outline" disabled={isLoading}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Clear Images</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Separator orientation="vertical" className="mx-1 h-6" />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="view-subfolders"
                            checked={viewSubfolders}
                            onCheckedChange={setViewSubfolders}
                            disabled={isLoading}
                          />
                          <Label
                            htmlFor="view-subfolders"
                            className="cursor-pointer text-sm"
                          >
                            Subfolders
                          </Label>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Show images from all subfolders.</p>
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
            files={paginatedFiles}
            selectedImageId={selectedImageId}
            onSelectImage={setSelectedImageId}
            gridCols={gridCols}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={setItemsPerPage}
            itemsPerPageOptions={ITEMS_PER_PAGE_OPTIONS}
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
          {!isRightPanelCollapsed && <MetadataViewer image={selectedImageFile} />}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}