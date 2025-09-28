"use client";

import * as React from "react";

import { AdvancedSearchState } from "@/components/advanced-search-form";
import { StoredImage } from "@/lib/image-db";

import { useDebounce } from "./use-debounce";

type SortBy = "lastModified" | "size";
type SortOrder = "asc" | "desc";

function checkMatch(value: string | null | undefined, query: string): boolean {
  if (!query) return true;
  if (value === null || value === undefined) return false;
  return String(value).toLowerCase().includes(query.toLowerCase());
}

export function useImageFiltering(allImageMetadata: StoredImage[], selectedPath: string) {
  const [viewSubfolders, setViewSubfolders] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<SortBy>("lastModified");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("desc");
  const [filterQuery, setFilterQuery] = React.useState("");
  const [advancedSearchState, setAdvancedSearchState] = React.useState<AdvancedSearchState>({
    prompt: "", negativePrompt: "", seed: "", cfg: "", steps: "", sampler: "", scheduler: "",
  });

  const debouncedFilterQuery = useDebounce(filterQuery, 300);
  const debouncedAdvancedSearch = useDebounce(advancedSearchState, 300);

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
      filtered = filtered.filter(image =>
        image.name.toLowerCase().includes(lowerCaseQuery) ||
        (image.workflow && image.workflow.toLowerCase().includes(lowerCaseQuery))
      );
    }

    const isAdvancedSearchActive = Object.values(debouncedAdvancedSearch).some(v => v !== "");
    if (isAdvancedSearchActive) {
      filtered = filtered.filter(image =>
        checkMatch(image.prompt, debouncedAdvancedSearch.prompt) &&
        checkMatch(image.negativePrompt, debouncedAdvancedSearch.negativePrompt) &&
        checkMatch(image.seed, debouncedAdvancedSearch.seed) &&
        checkMatch(image.cfg, debouncedAdvancedSearch.cfg) &&
        checkMatch(image.steps, debouncedAdvancedSearch.steps) &&
        checkMatch(image.sampler, debouncedAdvancedSearch.sampler) &&
        checkMatch(image.scheduler, debouncedAdvancedSearch.scheduler)
      );
    }

    filtered.sort((a, b) => {
      const compareA = a[sortBy];
      const compareB = b[sortBy];
      if (compareA === compareB) return 0;
      return sortOrder === 'asc' ? (compareA > compareB ? 1 : -1) : (compareA < compareB ? 1 : -1);
    });
    return filtered;
  }, [allImageMetadata, selectedPath, viewSubfolders, debouncedFilterQuery, debouncedAdvancedSearch, sortBy, sortOrder]);

  const handleAdvancedSearchChange = (newState: Partial<AdvancedSearchState>) => {
    setAdvancedSearchState(prev => ({ ...prev, ...newState }));
  };

  const handleAdvancedSearchReset = () => {
    setAdvancedSearchState({ prompt: "", negativePrompt: "", seed: "", cfg: "", steps: "", sampler: "", scheduler: "" });
  };

  return {
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
  };
}