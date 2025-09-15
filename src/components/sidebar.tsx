"use client";

import * as React from "react";
import {
  Folder,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import { AdvancedSearchForm, AdvancedSearchState } from "@/components/advanced-search-form";
import { FileTree } from "@/components/file-tree";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileTreeNode } from "@/lib/file-tree";

interface SidebarProps {
  isLoading: boolean;
  onFolderSelectClick: () => void;
  onRefreshClick: () => void;
  filterQuery: string;
  onFilterQueryChange: (query: string) => void;
  advancedSearchState: AdvancedSearchState;
  onAdvancedSearchChange: (state: Partial<AdvancedSearchState>) => void;
  onAdvancedSearchReset: () => void;
  viewSubfolders: boolean;
  onViewSubfoldersChange: (value: boolean) => void;
  onClearImages: () => void;
  fileTree: FileTreeNode | null;
  selectedPath: string;
  onSelectPath: (path: string) => void;
  selectedImageId: number | null;
  onSelectFile: (id: number) => void;
}

export function Sidebar({
  isLoading,
  onFolderSelectClick,
  onRefreshClick,
  filterQuery,
  onFilterQueryChange,
  advancedSearchState,
  onAdvancedSearchChange,
  onAdvancedSearchReset,
  viewSubfolders,
  onViewSubfoldersChange,
  onClearImages,
  fileTree,
  selectedPath,
  onSelectPath,
  selectedImageId,
  onSelectFile,
}: SidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <div className="w-full max-w-sm space-y-4">
          <h2 className="text-lg font-semibold">Folders</h2>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={onFolderSelectClick} variant="outline" disabled={isLoading}>
              <Folder className="mr-2 h-4 w-4" />
              Select Folder
            </Button>
            <Button onClick={onRefreshClick} variant="outline" disabled={isLoading}>
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
              onChange={(e) => onFilterQueryChange(e.target.value)}
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
                onSearchChange={onAdvancedSearchChange}
                onReset={onAdvancedSearchReset}
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
                    onCheckedChange={onViewSubfoldersChange}
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
          <Button onClick={onClearImages} variant="destructive" disabled={isLoading} className="w-full">
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
            onSelectPath={onSelectPath}
            selectedImageId={selectedImageId}
            onSelectFile={onSelectFile}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
            Select a folder to view its structure.
          </div>
        )}
      </ScrollArea>
    </div>
  );
}