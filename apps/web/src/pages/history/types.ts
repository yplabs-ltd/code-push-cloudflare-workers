// history 라우트는 서버 OpenAPI 응답 스키마가 비어 있어 api-client가 void로 생성한다.
// 실제 응답은 { history, totalCount, page, pageSize } 이므로 여기서 형태를 명시한다.
export interface ReleaseHistoryItem {
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

export interface HistoryResponse {
  history: ReleaseHistoryItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface MetricEntry {
  active?: number;
  downloads?: number;
  installed?: number;
  failed?: number;
}

export type MergedItem = ReleaseHistoryItem & MetricEntry;
