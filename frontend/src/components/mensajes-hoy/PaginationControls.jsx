/**
 * Pagination Controls Component
 * Reusable pagination UI for grouped data
 */
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { PAGE_SIZE_OPTIONS } from "./constants";

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  return (
    <div className="flex items-center justify-between mb-3 py-2 border-b border-[#222]">
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-sm">Mostrar:</span>
        <Select 
          value={String(pageSize)} 
          onValueChange={(v) => onPageSizeChange(parseInt(v))}
        >
          <SelectTrigger className="w-[80px] h-7 bg-[#0a0a0a] border-[#333] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map(size => (
              <SelectItem key={size} value={String(size)}>{size}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-slate-500 text-xs">
          Página {currentPage} de {totalPages} ({totalItems} total)
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="h-7 w-7 p-0 border-[#333]"
          >
            ‹
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="h-7 w-7 p-0 border-[#333]"
          >
            ›
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PaginationControls;
