"use client";

import * as React from "react";

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
import { isFileSystemAccessAPISupported, useAutoRefresh } from "@/hooks/use-auto-refresh";

export default function Home() {
  const [selectedPath, setSelectedPath] = React.useState<string>("");
  const [gridCols, setGridCols] = React.useState(4);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = React.useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = React.useState(false);
  const isJumpingRef = React.useRef(false);
  const [jumpToImageId, setJumpToImageId] = React.useState<number | null>(null);

  const {
    handleNewFiles,
    allImageMetadata,
    setAllImageMetadata,
    isLoading,
    progress,
    fileTree,
    fileInputRef,
    handleFileSelect,
    handleClearAllData,
    setIsRefreshMode
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

  const { directoryHandle, requestAndSetDirectory, scanForChanges, isScanning } =
    useAutoRefresh(handleNewFiles);

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

  const handleFileSelectWrapper = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const result = await handleFileSelect(event);
    if (result) {
      const { isRefresh, newTree } = result;
      if (!isRefresh && newTree) {
        setSelectedPath(newTree.path);
      }
      setSelectedImageId(null);
      setCurrentPage(1);
    }
  };

  const handleClearAllDataWrapper = () => {
    handleClearAllData();
    setSelectedPath("");
    setSelectedImageId(null);
    setCurrentPage(1);
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

  const handleFolderSelectClick = async () => {
    if (isFileSystemAccessAPISupported()) {
      const handle = await requestAndSetDirectory();

      if (handle) {
        const { name } = handle;
        if (name) {
          setSelectedPath(name);
        }
        setSelectedImageId(null);
        setCurrentPage(1);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleRefreshClick = () => {
    setIsRefreshMode(true);
    if (directoryHandle) {
      scanForChanges(false);
    } else {
      // Fallback for non-FSA API browsers or if no folder is selected
      fileInputRef.current?.click();
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
        isLoading={isLoading || isScanning}
        progress={progress}
        gridCols={gridCols}
        onGridColsChange={setGridCols}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelectWrapper}
        className="hidden"
        webkitdirectory="true"
        directory="true"
      />

      <ResizablePanelGroup direction="horizontal" className="w-full">
        <ResizablePanel
          defaultSize={15}
          minSize={4}
          collapsible
          collapsedSize={4}
          onCollapse={() => setIsLeftPanelCollapsed(true)}
          onExpand={() => setIsLeftPanelCollapsed(false)}
        >
          {!isLeftPanelCollapsed && (
            <Sidebar
              isLoading={isLoading || isScanning}
              onFolderSelectClick={handleFolderSelectClick}
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
              hasModernAccess={!!directoryHandle}
            />
          )}
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={65}>
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
            setAllImageMetadata={setAllImageMetadata}
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