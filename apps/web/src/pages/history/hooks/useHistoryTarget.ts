import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

// 조회 대상(앱·배포) 선택 상태와 자동 선택 규칙
export function useHistoryTarget() {
  const [appName, setAppName] = useState<string>("");
  const [deploymentName, setDeploymentName] = useState<string>("");

  const { data: appsData } = useQuery({
    queryKey: ["apps"],
    queryFn: async () => (await api.appsGet()).data,
  });
  const apps = appsData?.apps ?? [];

  useEffect(
    function selectFirstAppOnLoad() {
      if (!appName && apps.length > 0 && apps[0].name) {
        setAppName(apps[0].name);
      }
    },
    [apps, appName],
  );

  const { data: deploymentsData } = useQuery({
    queryKey: ["deployments", appName],
    queryFn: async () => (await api.appsAppNameDeploymentsGet(appName)).data,
    enabled: !!appName,
  });
  const deployments = deploymentsData?.deployments ?? [];

  // Production 우선, 없으면 첫 배포 선택
  useEffect(
    function selectDefaultDeployment() {
      if (deployments.length === 0) return;
      const names = deployments.map((d) => d.name).filter(Boolean) as string[];
      if (deploymentName && names.includes(deploymentName)) return;
      setDeploymentName(names.includes("Production") ? "Production" : names[0]);
    },
    [deployments, deploymentName],
  );

  return {
    apps,
    deployments,
    appName,
    setAppName,
    deploymentName,
    setDeploymentName,
    enabled: !!appName && !!deploymentName,
  };
}
