"use client";

import * as React from "react";

const ITEMS_PER_PAGE_OPTIONS = [12, 24, 48, 96, 200];
const ITEMS_PER_PAGE_KEY = "image-viewer-items-per-page";

export function usePagination(totalItems: number, dependencies: React.DependencyList) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(ITEMS_PER_PAGE_OPTIONS[1]);

  React.useEffect(() => {
    const stored = localStorage.getItem(ITEMS_PER_PAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (ITEMS_PER_PAGE_OPTIONS.includes(parsed)) {
        setItemsPerPage(parsed);
      }
    }
  }, []);

  React.useEffect(() => {
    localStorage.setItem(ITEMS_PER_PAGE_KEY, String(itemsPerPage));
  }, [itemsPerPage]);

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  React.useEffect(() => {
    setCurrentPage(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const getPaginatedItems = <T,>(items: T[]): T[] => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return items.slice(startIndex, startIndex + itemsPerPage);
  };

  return {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    getPaginatedItems,
    ITEMS_PER_PAGE_OPTIONS,
  };
}