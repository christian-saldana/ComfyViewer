"use client";

import * as React from "react";
import {
  Folder,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  Trash2,
  Search,
  SlidersHorizontal,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ImageGallery } from "@/components/image-gallery";
import { MetadataViewer } from "@/components/metadata-viewer";
import { FileTree } from "@/components/file-tree";
import { buildFileTree } from "@/lib/file-tree";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { storeImages, clearImages, StoredImage, getStoredImageFile, getAllStoredImageMetadata, addNewImages } from "@/lib/image-db";
import { Progress } from "@/components/ui/progress";
import { AdvancedSearchForm, AdvancedSearchState } from "@/components/advanced-search-form";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

type SortBy = "lastModified" | "size";
type SortOrder = "asc" | "desc";

const ITEMS_PER_PAGE_OPTIONS = [12, 24, 48, 96, 200];
const ITEMS_PER_PAGE_KEY = "image-viewer-items-per-page";

const initialAdvancedSearchState: AdvancedSearchState = {
  prompt: "",
  negativePrompt: "",
  seed: "",
  cfg: "",
  steps: "",
  sampler: "",
  scheduler: "",
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function checkMatch(value: string | null | undefined, query: string): boolean {
  if (!query) return true;
  if (value === null || value === undefined) return false;
  return String(value).toLowerCase().includes(query.toLowerCase());
}

export default function Home() {
  const [allImageMetadata, setAllImageMetadata] = React.useState<StoredImage[]>([]);
  const [selectedPath, setSelectedPath] = React.useState<string>("");
  const [selectedImageId, setSelectedImageId] = React.useState<number | null>(null);
  const [selectedImageFile, setSelectedImageFile] = React.useState<File | null>(null);
  const [selectedImageMetadata, setSelectedImageMetadata] = React.useState<StoredImage | null>(null);
  const [viewSubfolders, setViewSubfolders] = React.useState(false);
  const [gridCols, setGridCols] = React.useState(4);
  const [sortBy, setSortBy] = React.useState<SortBy>("lastModified");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [filterQuery, setFilterQuery] = React.useState("");
  const [advancedSearchState, setAdvancedSearchState] = React.useState<AdvancedSearchState>(initialAdvancedSearchState);
  const [isRefreshMode, setIsRefreshMode] = React.useState(false);
  const [jumpToImageId, setJumpToImageId] = React.useState<number | null>(null);

  const isJumpingRef = React.useRef(false);
  const debouncedFilterQuery = useDebounce(filterQuery, 300);
  const debouncedAdvancedSearch = useDebounce(advancedSearchState, 300);

  const [itemsPerPage, setItemsPerPage] = React.useState(ITEMS_PER_PAGE_OPTIONS[1]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  React.useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);
      const metadata = await getAllStoredImageMetadata();
      setAllImageMetadata(metadata);

      if (metadata.length > 0) {
        const tree = buildFileTree(metadata);
        const initialPath = tree ? tree.path : "";
        setSelectedPath(initialPath);
      }
      setIsLoading(false);
    }
    loadInitialData();
  }, []);

  const fileTree = React.useMemo(() => {
    return buildFileTree(allImageMetadata);
  }, [allImageMetadata]);

  const processedImages = React.useMemo(() => {
    if (!selectedPath) return [];

    let filtered = allImageMetadata.filter(image => {
      const parentDirectory = image.webkitRelativePath.substring(0, image.webkitRelativePath.lastIndexOf("/"));
      return viewSubfolders
        ? image.webkitRelativePath.startsWith(selectedPath)
        : parentDirectory === selectedPath;
    });

    if (debouncedFilterQuery) {
      const lowerCaseQuery = debouncedFilterQuery.toLowerCase();
      filtered = filtered.filter(image => {
        const nameMatch = image.name.toLowerCase().includes(lowerCaseQuery);
        const workflowMatch = image.workflow ? image.workflow.toLowerCase().includes(lowerCaseQuery) : false;
        return nameMatch || workflowMatch;
      });
    }

    const isAdvancedSearchActive = Object.values(debouncedAdvancedSearch).some(v => v !== "");
    if (isAdvancedSearchActive) {
      filtered = filtered.filter(image => {
        return (
          checkMatch(image.prompt, debouncedAdvancedSearch.prompt) &&
          checkMatch(image.negativePrompt, debouncedAdvancedSearch.negativePrompt) &&
          checkMatch(image.seed, debouncedAdvancedSearch.seed) &&
          checkMatch(image.cfg, debouncedAdvancedSearch.cfg) &&
          checkMatch(image.steps, debouncedAdvancedSearch.steps) &&
          checkMatch(image.sampler, debouncedAdvancedSearch.sampler) &&
          checkMatch(image.scheduler, debouncedAdvancedSearch.scheduler)
        );
      });
    }

    filtered.sort((a, b) => {
      const compareA = a[sortBy];
      const compareB = b[sortBy];
      if (compareA === compareB) return 0;

      if (sortOrder === 'asc') {
        return compareA > compareB ? 1 : -1;
      } else {
        return compareA < compareB ? 1 : -1;
      }
    });

    return filtered;
  }, [allImageMetadata, selectedPath, viewSubfolders, debouncedFilterQuery, debouncedAdvancedSearch, sortBy, sortOrder]);

  const totalPages = Math.ceil(processedImages.length / itemsPerPage);

  const paginatedFiles = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return processedImages.slice(startIndex, endIndex);
  }, [processedImages, currentPage, itemsPerPage]);

  React.useEffect(() => {
    if (isJumpingRef.current) {
      return;
    }
    setCurrentPage(1);
  }, [selectedPath, viewSubfolders, sortBy, sortOrder, itemsPerPage, debouncedFilterQuery, debouncedAdvancedSearch]);

  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  React.useEffect(() => {
    if (selectedImageId === null) {
      setSelectedImageFile(null);
      setSelectedImageMetadata(null);
      return;
    }

    const metadata = allImageMetadata.find(img => img.id === selectedImageId);
    setSelectedImageMetadata(metadata || null);

    let isCancelled = false;
    async function fetchFile() {
      const file = await getStoredImageFile(selectedImageId!);
      if (!isCancelled) {
        setSelectedImageFile(file);
      }
    }
    fetchFile();
    return () => { isCancelled = true; };
  }, [selectedImageId, allImageMetadata]);

  React.useEffect(() => {
    if (jumpToImageId !== null && processedImages.length > 0) {
      const imageIndex = processedImages.findIndex(img => img.id === jumpToImageId);
      if (imageIndex !== -1) {
        const page = Math.floor(imageIndex / itemsPerPage) + 1;
        setCurrentPage(page);
        isJumpingRef.current = false;
      }
      setJumpToImageId(null);
    }
  }, [jumpToImageId, processedImages, itemsPerPage]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        if (selectedImageId === null || processedImages.length === 0) {
          return;
        }

        const currentIndex = processedImages.findIndex(img => img.id === selectedImageId);
        if (currentIndex === -1) {
          return;
        }

        let nextIndex = currentIndex;
        const cols = gridCols;

        switch (event.key) {
          case 'ArrowRight':
            nextIndex = Math.min(currentIndex + 1, processedImages.length - 1);
            break;
          case 'ArrowLeft':
            nextIndex = Math.max(currentIndex - 1, 0);
            break;
          case 'ArrowDown':
            nextIndex = Math.min(currentIndex + cols, processedImages.length - 1);
            break;
          case 'ArrowUp':
            nextIndex = Math.max(currentIndex - cols, 0);
            break;
        }

        if (nextIndex !== currentIndex) {
          const nextImage = processedImages[nextIndex];
          setSelectedImageId(nextImage.id);

          const newImagePage = Math.floor(nextIndex / itemsPerPage) + 1;
          if (newImagePage !== currentPage) {
            setCurrentPage(newImagePage);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedImageId, processedImages, itemsPerPage, currentPage, gridCols]);

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

      if (isRefreshMode) {
        const newImageCount = await addNewImages(imageFiles, (p) => setProgress(p));
        if (newImageCount > 0) {
          toast.success(`${newImageCount} new image(s) added.`);
        } else {
          toast.info("No new images found.");
        }
        setIsRefreshMode(false);
      } else {
        await storeImages(imageFiles, (p) => setProgress(p));
        toast.success("Image library loaded.");
      }

      const metadata = await getAllStoredImageMetadata();
      setAllImageMetadata(metadata);
      setSelectedImageId(null);

      if (!isRefreshMode) {
        const newTree = buildFileTree(metadata);
        const newPath = newTree ? newTree.path : "";
        setSelectedPath(newPath);
      }

      setCurrentPage(1);
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleClearImages = async () => {
    await clearImages();
    setAllImageMetadata([]);
    setSelectedPath("");
    setSelectedImageId(null);
    setCurrentPage(1);
    toast.success("Image library cleared.");
  };

  const handleFolderSelect = (path: string) => {
    setSelectedPath(path);
    setSelectedImageId(null);
  };

  const handleFileSelectFromTree = (id: number) => {
    const imageMetadata = allImageMetadata.find(img => img.id === id);
    if (!imageMetadata) return;

    const parentPath = imageMetadata.webkitRelativePath.substring(0, imageMetadata.webkitRelativePath.lastIndexOf('/'));

    setSelectedImageId(id);
    
    if (parentPath !== selectedPath) {
        isJumpingRef.current = true;
        setSelectedPath(parentPath);
        setJumpToImageId(id);
    } else {
        setJumpToImageId(id);
    }
  };

  const handleFolderSelectClick = () => {
    setIsRefreshMode(false);
    fileInputRef.current?.click();
  };

  const handleRefreshClick = () => {
    setIsRefreshMode(true);
    fileInputRef.current?.click();
  };

  const handleAdvancedSearchChange = (newState: Partial<AdvancedSearchState>) => {
    setAdvancedSearchState(prev => ({ ...prev, ...newState }));
  };

  const handleAdvancedSearchReset = () => {
    setAdvancedSearchState(initialAdvancedSearchState);
  };

  return (
    <div className="grid h-full grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Image Viewer</h1>
          {isLoading && progress > 0 && progress < 100 && (
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

      <ResizablePanelGroup
        direction="horizontal"
        className="w-full"
      >
        <ResizablePanel
          defaultSize={20}
          minSize={4}
          collapsible
          collapsedSize={4}
          onCollapse={() => setIsLeftPanelCollapsed(true)}
          onExpand={() => setIsLeftPanelCollapsed(false)}
        >
          {!isLeftPanelCollapsed && (
            <div className="flex h-full flex-col">
              <div className="border-b p-4">
                <div className="w-full max-w-sm space-y-4">
                  <h2 className="text-lg font-semibold">Folders</h2>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={handleFolderSelectClick} variant="outline" disabled={isLoading}>
                      <Folder className="mr-2 h-4 w-4" />
                      Select Folder
                    </Button>
                    <Button onClick={handleRefreshClick} variant="outline" disabled={isLoading}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Filter by name or metadata..."
                      className="pl-8"
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full">
                        <SlidersHorizontal className="mr-2 h-4 w-4" />
                        Advanced Search
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-4">
                      <AdvancedSearchForm
                        searchState={advancedSearchState}
                        onSearchChange={handleAdvancedSearchChange}
                        onReset={handleAdvancedSearchReset}
                      />
                    </CollapsibleContent>
                  </Collapsible>
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
                            View Subfolders
                          </Label>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Show images from all subfolders.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button onClick={handleClearImages} variant="destructive" disabled={isLoading} className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear All Images
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1">
                {fileTree ? (
                  <FileTree
                    tree={fileTree}
                    selectedPath={selectedPath}
                    onSelectPath={handleFolderSelect}
                    selectedImageId={selectedImageId}
                    onSelectFile={handleFileSelectFromTree}
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
        <ResizableHandle />
        <ResizablePanel defaultSize={55}>
          <ImageGallery
            files={paginatedFiles}
            allImageMetadata={allImageMetadata}
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
        <ResizableHandle />
        <ResizablePanel
          defaultSize={25}
          minSize={4}
          collapsible
          collapsedSize={4}
          onCollapse={() => setIsRightPanelCollapsed(true)}
          onExpand={() => setIsRightPanelCollapsed(false)}
        >
          {!isRightPanelCollapsed && (
            <MetadataViewer imageFile={selectedImageFile} imageMetadata={selectedImageMetadata} />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}