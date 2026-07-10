// 서버 OpenAPI(/docs)가 Hono 콜론 스타일 경로(`/apps/:appName`)를 내보내는 탓에
// openapi-generator가 localVarPath 템플릿을 콜론 스타일로 생성한다.
// 그러나 생성된 코드의 .replace() 타깃은 중괄호 스타일(`{appName}`)이라
// 치환이 전혀 되지 않고 리터럴 `:appName`이 서버로 전송된다(모든 path-param 메서드 무동작).
// 이 스크립트는 생성 직후 src/api.ts의 경로 템플릿을 중괄호 스타일로 정규화한다.
// `generate` 스크립트 뒤에 체이닝되어 재생성 시 자동 적용된다.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "..", "src", "api.ts");

const before = readFileSync(target, "utf8");
// `/:paramName` (선택 마커 `?` 포함) → `/{paramName}`
const after = before.replace(/\/:([a-zA-Z_][a-zA-Z0-9_]*)\??/g, "/{$1}");

if (before === after) {
  console.log("[fix-colon-paths] 변경 없음 (이미 정규화됨)");
} else {
  const count = (before.match(/\/:([a-zA-Z_][a-zA-Z0-9_]*)\??/g) ?? []).length;
  writeFileSync(target, after);
  console.log(`[fix-colon-paths] ${count}개 콜론 경로 세그먼트를 중괄호로 정규화`);
}
