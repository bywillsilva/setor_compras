"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const DEFAULT_PAGE_SIZE = 10
export const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100] as const

type UseListPaginationOptions = {
  storageKey: string
  resetKey?: string
  initialPageSize?: number
}

export function useListPagination<T>(
  items: T[],
  options: UseListPaginationOptions,
) {
  const { storageKey, resetKey, initialPageSize = DEFAULT_PAGE_SIZE } = options
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialPageSize)

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(storageKey)
      if (!storedValue) {
        return
      }

      const parsedValue = Number(storedValue)
      if (PAGE_SIZE_OPTIONS.includes(parsedValue as (typeof PAGE_SIZE_OPTIONS)[number])) {
        setPageSizeState(parsedValue)
      }
    } catch {
      // Keep default when local storage is unavailable.
    }
  }, [storageKey])

  useEffect(() => {
    setCurrentPage(1)
  }, [resetKey])

  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return items.slice(startIndex, startIndex + pageSize)
  }, [currentPage, items, pageSize])

  function setPage(page: number) {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages))
  }

  function setPageSize(value: number) {
    setPageSizeState(value)
    setCurrentPage(1)

    try {
      window.localStorage.setItem(storageKey, String(value))
    } catch {
      // Ignore persistence failures and keep working with in-memory state.
    }
  }

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = totalItems === 0 ? 0 : Math.min(totalItems, currentPage * pageSize)

  return {
    currentPage,
    endItem,
    items: paginatedItems,
    pageSize,
    setPage,
    setPageSize,
    startItem,
    totalItems,
    totalPages,
  }
}

export function ListPaginationBar({
  currentPage,
  endItem,
  itemLabel = "item(s)",
  onPageChange,
  onPageSizeChange,
  pageSize,
  startItem,
  totalItems,
  totalPages,
}: {
  currentPage: number
  endItem: number
  itemLabel?: string
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  pageSize: number
  startItem: number
  totalItems: number
  totalPages: number
}) {
  const visiblePages = useMemo(() => buildVisiblePages(currentPage, totalPages), [currentPage, totalPages])

  return (
    <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
        <span>
          Mostrando {startItem}-{endItem} de {totalItems} {itemLabel}
        </span>

        <div className="flex items-center gap-2">
          <span>Itens por pagina</span>
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
            <SelectTrigger className="h-9 w-[92px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Pagination className="mx-0 w-full justify-start overflow-x-auto sm:w-auto sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(event) => {
                event.preventDefault()
                if (currentPage > 1) {
                  onPageChange(currentPage - 1)
                }
              }}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined}
            />
          </PaginationItem>

          {visiblePages.map((page, index) =>
            page === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <PaginationLink
                  href="#"
                  isActive={page === currentPage}
                  onClick={(event) => {
                    event.preventDefault()
                    onPageChange(page)
                  }}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(event) => {
                event.preventDefault()
                if (currentPage < totalPages) {
                  onPageChange(currentPage + 1)
                }
              }}
              className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}

function buildVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis", totalPages] as const
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const
  }

  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages] as const
}
