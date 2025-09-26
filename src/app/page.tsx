"use client";

import * as React from "react";

import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { ImageGallery } from "@/components/image-gallery";
import { MetadataViewer } from "@/components/metadata-viewer";
import { Sidebar } from "@/components/sidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useImageFiltering } from "@/hooks/use-image-filtering";
import { useImageSelection } from "@/hooks/use-image-selection";
import { useImageStore } from "@/hooks/use-image-store";
import { useKeyboardNavigation } from "@/hooks/use-keyboard-navigation";
import { usePagination } from "@/hooks/use-pagination";
import { StoredImage, storeMetadataOnly, getAllStoredImageMetadata } from "@/lib/image-db";

const FOLDER_PATH_KEY = "comfy-viewer-folder-path";

export default function Home() {
  const [selectedPath, setSelectedPath] = React.useState<string>("");
  const [gridCols, setGridCols] = React.useState(4);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = React.useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = React.useState(false);
  const isJumpingRef = React.useRef(false);
  const [jumpToImageId, setJumpToImageId] = React.useState<number | null>(null);
  const [folderPathInput, setFolderPathInput] = React.useState<string>("");


  const {
    allImageMetadata,
    setAllImageMetadata,
    isLoading,
    setIsLoading,
    progress,
    setProgress,
    fileTree,
    handleClearAllData,
  } = useImageStore();

  const {
    processedImages,
    viewSubfolders,
    setViewSubfolders,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    filterQuery,
    setFilterQuery,
    advancedSearchState,
    handleAdvancedSearchChange,
    handleAdvancedSearchReset,
  } = useImageFiltering(allImageMetadata, selectedPath);

  const {
    selectedImageId,
    setSelectedImageId,
    selectedImageFile,
    selectedImageMetadata,
  } = useImageSelection(allImageMetadata, setAllImageMetadata);

  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    getPaginatedItems,
    ITEMS_PER_PAGE_OPTIONS,
  } = usePagination(processedImages.length, [
    selectedPath,
    viewSubfolders,
    sortBy,
    sortOrder,
    filterQuery,
    advancedSearchState,
  ]);

  const paginatedFiles = getPaginatedItems(processedImages);

  useKeyboardNavigation({
    selectedImageId,
    setSelectedImageId,
    processedImages,
    gridCols,
    currentPage,
    setCurrentPage,
    itemsPerPage,
  });

  React.useEffect(() => {
    const storedPath = localStorage.getItem(FOLDER_PATH_KEY);
    if (storedPath) {
      setFolderPathInput(storedPath);
    }
  }, []);

  const handleClearAllDataWrapper = () => {
    handleClearAllData();
    setSelectedPath("");
    setSelectedImageId(null);
    setCurrentPage(1);
    localStorage.removeItem(FOLDER_PATH_KEY);
    setFolderPathInput("");
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

  const handleRefreshClick = async () => {
    setIsLoading(true);
    try {
      const existingPaths = allImageMetadata.map(img => img.fullPath).filter(Boolean);
      const selectedFolderPath = localStorage.getItem(FOLDER_PATH_KEY)

      if (!selectedFolderPath) throw Error('No folder has been selected.')

      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFolderPath, existingPaths }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to scan for new images.');
      }

      const newImages: StoredImage[] = await response.json();

      if (newImages.length > 0) {
        const rootFolderName = selectedFolderPath.split(/[/\\]/).filter(Boolean).pop() || 'root';
        const processedNewImages = newImages.map(meta => ({
          ...meta,
          webkitRelativePath: `${rootFolderName}/${meta.webkitRelativePath}`,
        }));

        await storeMetadataOnly(processedNewImages);
        const updatedMetadata = await getAllStoredImageMetadata();
        setAllImageMetadata(updatedMetadata);
        toast.success(`${newImages.length} new image(s) found and added.`);
      } else {
        toast.info("No new images found.");
      }
    } catch (error) {
      console.error("Error refreshing folder:", error);
      toast.error((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadFolderPath = async () => {
    if (!folderPathInput) {
      toast.error("Please enter a folder path.");
      return;
    }

    localStorage.setItem(FOLDER_PATH_KEY, folderPathInput);
    setIsLoading(true);
    setProgress(0);
    setAllImageMetadata([]); // Clear existing images immediately

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: folderPathInput }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to scan folder.');
      }

      const metadataArray: StoredImage[] = await response.json();

      if (metadataArray.length === 0) {
        toast.info("No images found in the specified folder.");
        setIsLoading(false);
        return;
      }

      // Clear existing data before adding new data
      await handleClearAllData();

      const rootFolderName = folderPathInput.split(/[/\\]/).filter(Boolean).pop() || 'root';

      const processedMetadata = metadataArray.map((meta) => ({
        ...meta,
        webkitRelativePath: `${rootFolderName}/${meta.webkitRelativePath}`,
      }));

      await storeMetadataOnly(processedMetadata, (p) => setProgress(p));

      // After storing, fetch from DB to get the final IDs
      const finalMetadata = await getAllStoredImageMetadata();
      setAllImageMetadata(finalMetadata);
      setSelectedPath(rootFolderName)

      toast.success(`Successfully loaded ${processedMetadata.length} images from ${folderPathInput}.`);

    } catch (error) {
      console.error("Error loading folder from path:", error);
      toast.error((error as Error).message || "Failed to load folder from path.");
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  React.useEffect(() => {
    if (fileTree && !selectedPath) {
      setSelectedPath(fileTree.path);
    }
  }, [fileTree, selectedPath]);

  React.useEffect(() => {
    if (jumpToImageId !== null && processedImages.length > 0) {
      const imageIndex = processedImages.findIndex(img => img.id === jumpToImageId);
      if (imageIndex !== -1) {
        const page = Math.floor(imageIndex / itemsPerPage) + 1;
        if (page !== currentPage) {
          setCurrentPage(page);
        }
      }
      setJumpToImageId(null);
      isJumpingRef.current = false;
    }
  }, [jumpToImageId, processedImages, itemsPerPage, currentPage, setCurrentPage]);

  return (
    <div className="grid h-full grid-rows-[auto_1fr]">
      <AppHeader
        isLoading={isLoading}
        progress={progress}
        gridCols={gridCols}
        onGridColsChange={setGridCols}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
      />

      <ResizablePanelGroup direction="horizontal" className="w-full">
        <ResizablePanel
          defaultSize={20}
          minSize={4}
          collapsible
          collapsedSize={4}
          onCollapse={() => setIsLeftPanelCollapsed(true)}
          onExpand={() => setIsLeftPanelCollapsed(false)}
        >
          {!isLeftPanelCollapsed && (
            <Sidebar
              isLoading={isLoading}
              onRefreshClick={handleRefreshClick}
              filterQuery={filterQuery}
              onFilterQueryChange={setFilterQuery}
              advancedSearchState={advancedSearchState}
              onAdvancedSearchChange={handleAdvancedSearchChange}
              onAdvancedSearchReset={handleAdvancedSearchReset}
              viewSubfolders={viewSubfolders}
              onViewSubfoldersChange={setViewSubfolders}
              onClearAllData={handleClearAllDataWrapper}
              fileTree={fileTree}
              selectedPath={selectedPath}
              onSelectPath={handleFolderSelect}
              selectedImageId={selectedImageId}
              onSelectFile={handleFileSelectFromTree}
              folderPathInput={folderPathInput}
              onFolderPathInputChange={setFolderPathInput}
              onLoadFolderPath={handleLoadFolderPath}
            />
          )}
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={60}>
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
            totalImagesCount={processedImages.length}
            folderPath={folderPathInput} // Pass folderPathInput here
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel
          defaultSize={20}
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