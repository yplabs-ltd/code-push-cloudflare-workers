import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface HistoryPaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  isFetching: boolean;
  onPageChange: (page: number) => void;
}

export const HistoryPagination = ({
  page,
  totalPages,
  totalCount,
  isFetching,
  onPageChange,
}: HistoryPaginationProps) => {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        전체 {totalCount}개 · {page}/{totalPages} 페이지
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || isFetching}
          onClick={() => onPageChange(1)}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || isFetching}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          이전
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages || isFetching}
          onClick={() => onPageChange(page + 1)}
        >
          다음
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages || isFetching}
          onClick={() => onPageChange(totalPages)}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
