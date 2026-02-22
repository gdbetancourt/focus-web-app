/**
 * Custom hook for managing group-based pagination
 * Used in MensajesHoy for WhatsApp, LinkedIn, and Email tabs
 */
import { useState, useCallback } from "react";

const DEFAULT_PAGE_SIZE = 10;

export function usePagination(defaultPageSize = DEFAULT_PAGE_SIZE) {
  const [pages, setPages] = useState({});
  const [pageSizes, setPageSizes] = useState({});

  const getPageSize = useCallback((groupKey) => {
    return pageSizes[groupKey] || defaultPageSize;
  }, [pageSizes, defaultPageSize]);

  const setPageSize = useCallback((groupKey, size) => {
    setPageSizes(prev => ({ ...prev, [groupKey]: size }));
    // Reset to page 1 when page size changes
    setPages(prev => ({ ...prev, [groupKey]: 1 }));
  }, []);

  const getCurrentPage = useCallback((groupKey) => {
    return pages[groupKey] || 1;
  }, [pages]);

  const setCurrentPage = useCallback((groupKey, page) => {
    setPages(prev => ({ ...prev, [groupKey]: page }));
  }, []);

  const getPaginatedItems = useCallback((groupKey, items) => {
    const currentPage = pages[groupKey] || 1;
    const pageSize = pageSizes[groupKey] || defaultPageSize;
    const startIndex = (currentPage - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [pages, pageSizes, defaultPageSize]);

  const getTotalPages = useCallback((groupKey, items) => {
    const pageSize = pageSizes[groupKey] || defaultPageSize;
    return Math.ceil(items.length / pageSize);
  }, [pageSizes, defaultPageSize]);

  const resetPagination = useCallback(() => {
    setPages({});
    setPageSizes({});
  }, []);

  return {
    getPageSize,
    setPageSize,
    getCurrentPage,
    setCurrentPage,
    getPaginatedItems,
    getTotalPages,
    resetPagination,
  };
}

export default usePagination;
