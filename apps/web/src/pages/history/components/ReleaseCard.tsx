import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Power, Zap } from "lucide-react";
import type { MergedItem } from "../types";

function formatBytes(bytes?: number): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"] as const;
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatTime(ts?: number): string {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return "-";
  return new Date(ts).toLocaleString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

interface ReleaseCardProps {
  item: MergedItem;
  onToggleDisable: (item: MergedItem) => void;
  onToggleMandatory: (item: MergedItem) => void;
  isDisablePending: boolean;
  isMandatoryPending: boolean;
}

export const ReleaseCard = ({
  item,
  onToggleDisable,
  onToggleMandatory,
  isDisablePending,
  isMandatoryPending,
}: ReleaseCardProps) => {
  return (
    <Card
      className={cn(
        (item.installed ?? 0) > 50 && "border-l-4 border-l-emerald-500",
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <CardTitle className="font-mono text-base">{item.label}</CardTitle>
            <span className="font-mono text-xs text-muted-foreground">
              App {item.appVersion ?? "-"}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {item.isMandatory && (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-amber-700"
              >
                Mandatory
              </Badge>
            )}
            {item.isDisabled ? (
              <Badge className="gap-1 border-transparent bg-red-50 text-red-700 hover:bg-red-50">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                Disabled
              </Badge>
            ) : (
              <Badge className="gap-1 border-transparent bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                Active
              </Badge>
            )}
          </div>
        </div>
        <p className="mt-2 min-h-[1.25rem] truncate text-sm text-muted-foreground">
          {item.description || "-"}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pb-4">
        <div className="flex">
          <div className="flex-1 pr-3.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Installed
            </div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">
              {(item.installed ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="flex-1 border-l pl-3.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Active
            </div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">
              {(item.active ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="flex-1 border-l pl-3.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Size
            </div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums">
              {formatBytes(item.size)}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">
            {formatTime(item.uploadTime)}
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs [&_svg]:size-3"
              disabled={isMandatoryPending}
              onClick={() => onToggleMandatory(item)}
            >
              <Zap
                className={
                  item.isMandatory ? "text-muted-foreground" : "text-amber-600"
                }
              />
              {item.isMandatory ? "Optional" : "Mandatory"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs [&_svg]:size-3"
              disabled={isDisablePending}
              onClick={() => onToggleDisable(item)}
            >
              <Power
                className={
                  item.isDisabled ? "text-emerald-600" : "text-red-600"
                }
              />
              {item.isDisabled ? "Enable" : "Disable"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
