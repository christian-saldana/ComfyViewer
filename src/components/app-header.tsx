"use client";

import * as React from "react";

import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

type SortBy = "lastModified" | "size";
type SortOrder = "asc" | "desc";

interface AppHeaderProps {
  isLoading: boolean;
  progress: number;
  gridCols: number;
  onGridColsChange: (cols: number) => void;
  sortBy: SortBy;
  onSortByChange: (sortBy: SortBy) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (sortOrder: SortOrder) => void;
}

const MIN_COLS = 1;
const MAX_COLS = 12;

export function AppHeader({
  isLoading,
  progress,
  gridCols,
  onGridColsChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
}: AppHeaderProps) {
  const handleSliderChange = (value: number[]) => {
    const newGridCols = MAX_COLS + MIN_COLS - value[0];
    onGridColsChange(newGridCols);
  };

  const sliderValue = MAX_COLS + MIN_COLS - gridCols;

  return (
    <header className="flex items-center justify-between border-b p-4">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold">ComfyViewer</h1>
        {isLoading && progress > 0 && progress < 100 && (
          <div className="flex w-48 items-center gap-2">
            <Progress value={progress} className="w-full" />
            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
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
            onValueChange={(value: SortBy) => onSortByChange(value)}
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
            onClick={() => onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")}
          >
            {sortOrder === "asc" ? (
              <ArrowUpNarrowWide className="h-4 w-4" />
            ) : (
              <ArrowDownWideNarrow className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}