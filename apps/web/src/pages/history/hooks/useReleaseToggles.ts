import { api } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MergedItem } from "../types";

// disabled/mandatory 토글 액션 (confirm 포함)
export function useReleaseToggles(appName: string, deploymentName: string) {
  const queryClient = useQueryClient();

  const invalidateHistory = () => {
    queryClient.invalidateQueries({
      queryKey: ["history", appName, deploymentName],
    });
  };

  const alertError = (error: unknown) => {
    const message =
      (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message ?? "릴리즈 업데이트에 실패했습니다.";
    window.alert(message);
  };

  const disableMutation = useMutation({
    mutationFn: async ({
      label,
      isDisabled,
    }: {
      label: string;
      isDisabled: boolean;
    }) =>
      api.appsAppNameDeploymentsDeploymentNameReleaseDisabledPatch(
        appName,
        deploymentName,
        { label, isDisabled },
      ),
    onSuccess: invalidateHistory,
    onError: alertError,
  });

  const mandatoryMutation = useMutation({
    mutationFn: async ({
      label,
      isMandatory,
    }: {
      label: string;
      isMandatory: boolean;
    }) =>
      api.appsAppNameDeploymentsDeploymentNameReleaseMandatoryPatch(
        appName,
        deploymentName,
        { label, isMandatory },
      ),
    onSuccess: invalidateHistory,
    onError: alertError,
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

  const onToggleMandatory = (item: MergedItem) => {
    if (!item.label) return;
    const willMandatory = !item.isMandatory;
    const confirmed = window.confirm(
      `Label: ${item.label}\nDescription: ${item.description ?? "-"}\n\n이 버전을 ${
        willMandatory ? "Mandatory로 설정" : "Optional로 해제"
      }하시겠습니까?${
        willMandatory
          ? "\n\n⚠️ Mandatory 설정 시 이 버전 이전을 실행 중인 기기들의 다음 업데이트가 강제 업데이트로 승격됩니다."
          : ""
      }`,
    );
    if (!confirmed) return;
    mandatoryMutation.mutate({ label: item.label, isMandatory: willMandatory });
  };

  return {
    onToggleDisable,
    onToggleMandatory,
    isDisablePending: disableMutation.isPending,
    isMandatoryPending: mandatoryMutation.isPending,
  };
}
