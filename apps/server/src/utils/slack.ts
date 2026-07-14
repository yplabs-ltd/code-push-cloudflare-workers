import type { Env } from "../types/env";

type ReleaseActionType =
  | "Uploaded"
  | "Enabled"
  | "Disabled"
  | "MandatoryOn"
  | "MandatoryOff";

const SLACK_WEBHOOK_BASE = "https://hooks.slack.com/services";

const ACTION_HEADER: Record<ReleaseActionType, string> = {
  Uploaded: "새 릴리즈 업로드",
  Enabled: "Disabled false",
  Disabled: "Disabled true",
  MandatoryOn: "Mandatory true",
  MandatoryOff: "Mandatory false",
};

// 헤더 블록에서 이모지는 크게 렌더링되므로 토글류는 플레인 문자를 쓴다.
// 기호는 on/off가 아니라 카테고리 구분(Disabled=✕, Mandatory=★). on/off는 헤더 텍스트가 표현.
const ACTION_EMOJI: Record<ReleaseActionType, string> = {
  Uploaded: "🚀",
  Enabled: "✕",
  Disabled: "✕",
  MandatoryOn: "★",
  MandatoryOff: "★",
};

type ReleaseNotificationType = {
  appName: string;
  label?: string;
  appVersion: string;
  description?: string;
  isMandatory?: boolean;
  isDisabled?: boolean;
  action: ReleaseActionType;
  releasedBy?: string;
};

/**
 * 릴리즈 이벤트를 Slack 채널로 알린다(fire-and-forget 용).
 * CODE_PUSH_NOTI_SLACK 미설정 시 조용히 스킵. 절대 throw 하지 않는다
 * (waitUntil unhandled rejection 방지).
 */
export const sendReleaseNotification = async (
  env: Env["Bindings"],
  info: ReleaseNotificationType,
): Promise<void> => {
  try {
    if (!env.CODE_PUSH_NOTI_SLACK) return;

    const platform = info.appName.toLowerCase().includes("android")
      ? "Android"
      : "iOS";
    const header = `${ACTION_EMOJI[info.action]} ${platform} · ${ACTION_HEADER[info.action]}`;

    // 라벨 + 앱 버전을 굵게, 설명은 있을 때만 다음 줄에.
    const summary = `*${info.label || "-"}*  ·  App ${info.appVersion}`;
    const body = info.description ? `${summary}\n${info.description}` : summary;

    // 부가 정보는 작은 context 줄로 (Mandatory · Disabled · 작성자)
    const context = [
      `Mandatory ${info.isMandatory ? "✓" : "✗"}`,
      `Disabled ${info.isDisabled ? "✓" : "✗"}`,
      `👤 ${info.releasedBy || "-"}`,
    ].join("   ·   ");

    const blocks = [
      {
        type: "header",
        text: { type: "plain_text", text: header, emoji: true },
      },
      { type: "section", text: { type: "mrkdwn", text: body } },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: context }],
      },
    ];

    const res = await fetch(
      `${SLACK_WEBHOOK_BASE}/${env.CODE_PUSH_NOTI_SLACK}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: header, blocks }),
      },
    );

    if (!res.ok) {
      console.error(
        `Slack notification failed: ${res.status} ${await res.text()}`,
      );
    }
  } catch (error) {
    console.error("Slack notification error:", error);
  }
};
