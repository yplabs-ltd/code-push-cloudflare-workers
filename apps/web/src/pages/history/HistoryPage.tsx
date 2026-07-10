import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

// history 라우트는 서버 OpenAPI 응답 스키마가 비어 있어 api-client가 void로 생성한다.
// 실제 응답은 { history: Package[] } 이므로 여기서 형태를 명시한다.
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
}
interface MetricEntry {
  active?: number;
  downloads?: number;
  installed?: number;
  failed?: number;
}
type MergedItem = ReleaseHistoryItem & MetricEntry;

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

export const HistoryPage = () => {
  const queryClient = useQueryClient();
  const [appName, setAppName] = useState<string>("");
  const [deploymentName, setDeploymentName] = useState<string>("");

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

  const historyEnabled = !!appName && !!deploymentName;

  const {
    data: historyData,
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    isFetching,
  } = useQuery({
    queryKey: ["history", appName, deploymentName],
    queryFn: async () => {
      const response = await api.appsAppNameDeploymentsDeploymentNameHistoryGet(
        appName,
        deploymentName,
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

  const rows: MergedItem[] = useMemo(() => {
    const history = historyData?.history ?? [];
    const metrics = (metricsData?.metrics ?? {}) as Record<string, MetricEntry>;
    return history
      .slice()
      .sort((a, b) => (b.uploadTime ?? 0) - (a.uploadTime ?? 0))
      .map((item) => ({
        ...item,
        ...(item.label ? metrics[item.label] : {}),
      }));
  }, [historyData, metricsData]);

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
    const enableWarning = willDisable
      ? ""
      : "\n\n⚠️ 서버가 재활성화(isDisabled:false)를 무시하는 상태일 수 있습니다. 반영되지 않으면 서버 수정이 필요합니다.";
    const confirmed = window.confirm(
      `Label: ${item.label}\nDescription: ${item.description ?? "-"}\n\n이 버전을 ${
        willDisable ? "비활성화" : "활성화"
      }하시겠습니까?${enableWarning}`,
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

      <div className="rounded-lg border">
        {isHistoryLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            데이터를 불러오는 중입니다...
          </div>
        ) : isHistoryError ? (
          <div className="p-8 text-center text-sm text-destructive">
            이력을 불러오지 못했습니다. 새로고침하거나 다시 로그인해 주세요.
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            릴리즈 이력이 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>App Version</TableHead>
                <TableHead className="text-center">Mandatory</TableHead>
                <TableHead className="text-center">Disabled</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Installed</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-center">Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.label}>
                  <TableCell className="font-medium">{item.label}</TableCell>
                  <TableCell>{item.appVersion}</TableCell>
                  <TableCell className="text-center">
                    {item.isMandatory ? (
                      <Check className="mx-auto h-4 w-4 text-emerald-600" />
                    ) : (
                      <X className="mx-auto h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.isDisabled ? (
                      <Badge variant="destructive">Disabled</Badge>
                    ) : (
                      <Badge variant="secondary">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate">
                    {item.description || "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.installed ?? 0}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.active ?? 0}
                  </TableCell>
                  <TableCell className="text-center">
                    {formatBytes(item.size)}
                  </TableCell>
                  <TableCell>{formatTime(item.uploadTime)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={item.isDisabled ? "outline" : "destructive"}
                      size="sm"
                      className="min-w-[84px]"
                      disabled={disableMutation.isPending}
                      onClick={() => onToggleDisable(item)}
                    >
                      {item.isDisabled ? "Enable" : "Disable"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
