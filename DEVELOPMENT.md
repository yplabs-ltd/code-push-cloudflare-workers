# 실행 · 배포 가이드

CodePush 서버/웹의 로컬 실행과 배포 방법 (명령어 위주).

## 0. 프로젝트 구조

모노레포 (pnpm + turbo):

| 경로 | 내용 |
| --- | --- |
| `apps/server` | Hono 기반 Cloudflare Worker (D1 + R2) |
| `apps/web` | Vite + React SPA |
| `packages/api-client` | 서버 OpenAPI에서 생성한 typescript-axios 클라이언트 |

배포 대상:

| | 워커 | URL | D1 | 배포 방식 |
| --- | --- | --- | --- | --- |
| 서버 | `code-push-server-preview` | `code-push-server-preview.yplabs.workers.dev` | `codepush-server-prod` | **main 머지 시 자동** (Cloudflare Workers Builds) |
| 웹 | `codepush-web` | `codepush-web.yplabs.workers.dev` | — | **수동** (`pnpm deploy`) |

## 1. 공통 준비

```bash
pnpm install
```

- ⚠️ `wrangler` / `node` 실행 전에 반드시 `unset NODE_OPTIONS` (안 하면 preload 스크립트 관련 크래시).
- Cloudflare 로그인: `npx wrangler login` (`npx wrangler whoami`로 확인).

---

## 2. 서버 (`apps/server`)

### 2-1. 로컬 실행

```bash
cd apps/server
unset NODE_OPTIONS
wrangler dev --env local          # http://localhost:8787, 로컬 D1(sqlite)
```

`.dev.vars` (git ignore됨) 예시:

```
JWT_SECRET=local-dev-secret
ACCOUNT_ID=dummy
R2_BUCKET_NAME=code-push-storage
R2_ACCESS_KEY_ID=dummy
R2_SECRET_ACCESS_KEY=dummy
GITHUB_CLIENT_SECRET=dummy
```

### 2-2. 프로덕션 DB를 로컬로 안전 복제해서 테스트

> 원칙: prod에서는 **export(읽기)만**. 모든 쓰기는 로컬 사본에만 → prod 무영향.

```bash
cd apps/server
unset NODE_OPTIONS

# 1) prod D1 덤프 (원격 읽기 전용)
wrangler d1 export DB --env production --remote --output /tmp/prod.sql

# 2) (선택) 대용량 텔레메트리 테이블 제외 → 주입 빠르게
grep -v '^INSERT INTO "client_label"' /tmp/prod.sql > /tmp/prod-trim.sql

# 3) 로컬 D1 파일 생성: dev를 한 번 띄웠다 끄면 sqlite 파일이 만들어짐
wrangler dev --env local          # 뜨면 Ctrl+C
DB_FILE=$(find .wrangler/state/v3/d1 -name '*.sqlite' | head -1)

# 4) sqlite3로 직접 주입
#    (wrangler d1 execute --file 은 DDL+DML 혼합 파일에서 실패하므로 sqlite3 사용)
sqlite3 "$DB_FILE" < /tmp/prod-trim.sql

# 5) 로컬 서버 = 완전 격리된 사본
wrangler dev --env local          # http://localhost:8787
```

인증 우회 (사본에 실계정이 있으니 그 accountId로 JWT 발급):

```bash
# .dev.vars 의 JWT_SECRET 과 동일 키로 HS256 서명 (@tsndr/cloudflare-worker-jwt)
# payload: { sub: "<accountId>", email: "<email>" }
curl http://localhost:8787/apps/<app>/deployments/<deployment>/history \
  -H "Authorization: Bearer <발급한 JWT>"
```

- accountId 확인: `sqlite3 "$DB_FILE" "SELECT id, email FROM account;"`
- enable/disable·협업자 변경 등 **쓰기는 전부 사본에만** 반영 → prod 안전.
- R2 블롭은 복제되지 않음(더미 creds) → 번들 다운로드만 불가, 히스토리/플래그/협업자/회원 테스트엔 무관.

### 2-3. 배포

- **자동**: `main` 브랜치에 머지되면 Cloudflare Workers Builds가 `code-push-server-preview`를 자동 배포한다. (대시보드 연동 설정이며 레포 YAML에는 없음.)
- **수동**:
  ```bash
  cd apps/server && unset NODE_OPTIONS
  pnpm publish        # = wrangler deploy --env production
  ```
- **배포 확인**: `wrangler deployments list --env production`
- **CI**: `.github/workflows/test.yml` — PR / main push 시 `apps/server`에서 `pnpm typecheck` + `pnpm check`(biome) + `pnpm test`(vitest).

### 2-4. 프로덕션 D1 직접 조회/수정

```bash
cd apps/server && unset NODE_OPTIONS
wrangler d1 execute DB --env production --remote --command "SELECT ..."   # 읽기
wrangler d1 execute DB --env production --remote --command "UPDATE ..."   # 쓰기(주의)
```

---

## 3. 웹 (`apps/web`)

### 3-1. 로컬 실행

```bash
cd apps/web
unset NODE_OPTIONS
pnpm dev            # http://localhost:5173
```

- API 주소는 `VITE_API_URL`. 우선순위상 `.env.local`(prod 서버 지정)이 `.env.development`(localhost)를 덮으므로, **로컬 서버로 강제**하려면 `.env.development.local` 생성:
  ```
  VITE_API_URL=http://localhost:8787
  ```
- 로컬 서버에 붙일 때 인증: 인증은 `session` httpOnly 쿠키 방식. 브라우저 콘솔에서 로컬 JWT를 쿠키로 주입:
  ```js
  document.cookie = "session=<발급한 JWT>; path=/";
  ```

### 3-2. 배포 (수동 — 자동 배포 없음)

```bash
cd apps/web
unset NODE_OPTIONS
pnpm deploy          # = pnpm build && wrangler deploy → codepush-web
```

- 프로덕션 `VITE_API_URL`은 `.env.production` / `.env.local` (prod 서버).
- 배포 직후 엣지 캐시로 이전 HTML이 잠깐 보일 수 있음(잠시 후 갱신).

---

## 4. api-client 재생성

서버 라우트가 바뀌면 클라이언트를 재생성한다. **로컬 서버가 떠 있어야 한다** (`localhost:8787/docs` 참조).

```bash
# 터미널 A: 서버 실행
cd apps/server && unset NODE_OPTIONS && wrangler dev --env local

# 터미널 B: 재생성 + 빌드
cd packages/api-client && unset NODE_OPTIONS
pnpm generate        # openapi 생성 + fix-colon-paths 정규화 자동
pnpm build           # dist 빌드 (웹이 이 dist를 사용)
```
