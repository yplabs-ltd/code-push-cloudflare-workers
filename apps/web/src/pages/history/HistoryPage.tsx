import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 20;

// history 라우트는 서버 OpenAPI 응답 스키마가 비어 있어 api-client가 void로 생성한다.
// 실제 응답은 { history, totalCount, page, pageSize } 이므로 여기서 형태를 명시한다.
interface ReleaseHistoryItem {
  label?: string;
  appVersion?: string;
  isMandatory?: boolean;
  isDisabled?: boolean;
  description?: string;
  size?: number;
  rollout?: number | null;
  releaseMethod?: string;
  uploadTime?: number;
}
interface HistoryResponse {
  history: ReleaseHistoryItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}
interface MetricEntry {
  active?: number;
  downloads?: number;
  installed?: number;
  failed?: number;
}
type MergedItem = ReleaseHistoryItem & MetricEntry;

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

export const HistoryPage = () => {
  const queryClient = useQueryClient();
  const [appName, setAppName] = useState<string>("");
  const [deploymentName, setDeploymentName] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  const { data: appsData } = useQuery({
    queryKey: ["apps"],
    queryFn: async () => (await api.appsGet()).data,
  });
  const apps = appsData?.apps ?? [];

  // 앱 목록 로드 시 첫 앱 선택
  useEffect(() => {
    if (!appName && apps.length > 0 && apps[0].name) {
      setAppName(apps[0].name);
    }
  }, [apps, appName]);

  const { data: deploymentsData } = useQuery({
    queryKey: ["deployments", appName],
    queryFn: async () => (await api.appsAppNameDeploymentsGet(appName)).data,
    enabled: !!appName,
  });
  const deployments = deploymentsData?.deployments ?? [];

  // 배포 목록 로드 시 Production 우선, 없으면 첫 배포 선택
  useEffect(() => {
    if (deployments.length === 0) return;
    const names = deployments.map((d) => d.name).filter(Boolean) as string[];
    if (deploymentName && names.includes(deploymentName)) return;
    setDeploymentName(names.includes("Production") ? "Production" : names[0]);
  }, [deployments, deploymentName]);

  // 앱·배포를 바꾸면 첫 페이지로 되돌린다.
  useEffect(() => {
    setPage(1);
  }, [appName, deploymentName]);

  const historyEnabled = !!appName && !!deploymentName;

  const {
    data: historyData,
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    isFetching,
  } = useQuery({
    queryKey: ["history", appName, deploymentName, page],
    queryFn: async () => {
      const response = await api.appsAppNameDeploymentsDeploymentNameHistoryGet(
        appName,
        deploymentName,
        page,
        PAGE_SIZE,
      );
      // 위 주석 참조: 서버 실제 응답 형태로 해석
      return response.data as unknown as HistoryResponse;
    },
    enabled: historyEnabled,
  });

  const { data: metricsData } = useQuery({
    queryKey: ["metrics", appName, deploymentName],
    queryFn: async () =>
      (
        await api.appsAppNameDeploymentsDeploymentNameMetricsGet(
          appName,
          deploymentName,
        )
      ).data,
    enabled: historyEnabled,
  });

  // 서버가 최신순 페이지를 내려주므로 정렬은 서버에 맡기고 지표만 병합한다.
  const rows: MergedItem[] = useMemo(() => {
    const history = historyData?.history ?? [];
    const metrics = (metricsData?.metrics ?? {}) as Record<string, MetricEntry>;
    return history.map((item) => ({
      ...item,
      ...(item.label ? metrics[item.label] : {}),
    }));
  }, [historyData, metricsData]);

  const totalCount = historyData?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const disableMutation = useMutation({
    mutationFn: async ({
      label,
      isDisabled,
    }: {
      label: string;
      isDisabled: boolean;
    }) =>
      api.appsAppNameDeploymentsDeploymentNameReleasePatch(
        appName,
        deploymentName,
        { packageInfo: { label, isDisabled } },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["history", appName, deploymentName],
      });
    },
    onError: (error) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ?? "릴리즈 업데이트에 실패했습니다.";
      window.alert(message);
    },
  });

  const onToggleDisable = (item: MergedItem) => {
    if (!item.label) return;
    const willDisable = !item.isDisabled;
    const confirmed = window.confirm(
      `Label: ${item.label}\nDescription: ${item.description ?? "-"}\n\n이 버전을 ${
        willDisable ? "비활성화" : "활성화"
      }하시겠습니까?`,
    );
    if (!confirmed) return;
    disableMutation.mutate({ label: item.label, isDisabled: willDisable });
  };

  const refetch = () => {
    queryClient.invalidateQueries({
      queryKey: ["history", appName, deploymentName],
    });
    queryClient.invalidateQueries({
      queryKey: ["metrics", appName, deploymentName],
    });
  };

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
          disabled={isFetching || !historyEnabled}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {isFetching ? "로딩중..." : "새로고침"}
        </Button>
      </div>

      {isHistoryLoading ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          데이터를 불러오는 중입니다...
        </div>
      ) : isHistoryError ? (
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
              <Card
                key={item.label}
                className={item.isDisabled ? "opacity-60" : undefined}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <CardTitle className="text-base">
                          {item.label}
                        </CardTitle>
                        <span className="text-base font-semibold">
                          v{item.appVersion ?? "-"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatTime(item.uploadTime)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {item.isMandatory && (
                        <Badge variant="outline">Mandatory</Badge>
                      )}
                      {item.isDisabled ? (
                        <Badge variant="destructive">Disabled</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 min-h-[1.25rem] truncate text-sm text-muted-foreground">
                    {item.description || "-"}
                  </p>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-2 pb-4">
                  <span className="text-sm text-muted-foreground">
                    설치 {item.installed ?? 0} · 활성 {item.active ?? 0}
                  </span>
                  <Button
                    variant={item.isDisabled ? "outline" : "destructive"}
                    size="sm"
                    disabled={disableMutation.isPending}
                    onClick={() => onToggleDisable(item)}
                  >
                    {item.isDisabled ? "Enable" : "Disable"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              전체 {totalCount}개 · {page}/{totalPages} 페이지
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                이전
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((prev) => prev + 1)}
              >
                다음
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
