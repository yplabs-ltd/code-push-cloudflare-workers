import { api } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { HistoryResponse, MergedItem, MetricEntry } from "../types";

const PAGE_SIZE = 20;

// 릴리즈 이력·지표 조회와 페이지 상태
export function useReleaseHistory(
  appName: string,
  deploymentName: string,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState<number>(1);

  useEffect(
    function resetPageOnTargetChange() {
      setPage(1);
    },
    [appName, deploymentName],
  );

  const {
    data: historyData,
    isLoading,
    isError,
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
      // types.ts 주석 참조: 서버 실제 응답 형태로 해석
      return response.data as unknown as HistoryResponse;
    },
    enabled,
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
    enabled,
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

  const refetch = () => {
    queryClient.invalidateQueries({
      queryKey: ["history", appName, deploymentName],
    });
    queryClient.invalidateQueries({
      queryKey: ["metrics", appName, deploymentName],
    });
  };

  return {
    rows,
    page,
    setPage,
    totalCount,
    totalPages,
    isLoading,
    isError,
    isFetching,
    refetch,
  };
}
