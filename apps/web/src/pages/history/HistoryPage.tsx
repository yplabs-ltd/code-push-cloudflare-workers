import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw } from "lucide-react";
import { HistoryPagination } from "./components/HistoryPagination";
import { ReleaseCard } from "./components/ReleaseCard";
import { useHistoryTarget } from "./hooks/useHistoryTarget";
import { useReleaseHistory } from "./hooks/useReleaseHistory";
import { useReleaseToggles } from "./hooks/useReleaseToggles";

export const HistoryPage = () => {
  const {
    apps,
    deployments,
    appName,
    setAppName,
    deploymentName,
    setDeploymentName,
    enabled,
  } = useHistoryTarget();

  const {
    rows,
    page,
    setPage,
    totalCount,
    totalPages,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useReleaseHistory(appName, deploymentName, enabled);

  const {
    onToggleDisable,
    onToggleMandatory,
    isDisablePending,
    isMandatoryPending,
  } = useReleaseToggles(appName, deploymentName);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Release History</h1>
        <p className="text-muted-foreground">
          앱·배포별 CodePush 릴리즈 이력과 활성화 상태
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {apps.length > 0 && (
            <Tabs value={appName} onValueChange={setAppName}>
              <TabsList>
                {apps.map((app) => (
                  <TabsTrigger key={app.id} value={app.name ?? ""}>
                    {app.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          <Select
            value={deploymentName}
            onValueChange={setDeploymentName}
            disabled={deployments.length === 0}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Deployment" />
            </SelectTrigger>
            <SelectContent>
              {deployments.map((d) => (
                <SelectItem key={d.id} value={d.name ?? ""}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          onClick={refetch}
          disabled={isFetching || !enabled}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {isFetching ? "로딩중..." : "새로고침"}
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          데이터를 불러오는 중입니다...
        </div>
      ) : isError ? (
        <div className="rounded-lg border p-8 text-center text-sm text-destructive">
          이력을 불러오지 못했습니다. 새로고침하거나 다시 로그인해 주세요.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          릴리즈 이력이 없습니다.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((item) => (
              <ReleaseCard
                key={item.label}
                item={item}
                onToggleDisable={onToggleDisable}
                onToggleMandatory={onToggleMandatory}
                isDisablePending={isDisablePending}
                isMandatoryPending={isMandatoryPending}
              />
            ))}
          </div>

          <HistoryPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            isFetching={isFetching}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
};
