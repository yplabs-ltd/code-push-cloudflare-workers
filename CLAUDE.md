# 프로젝트 지침 — code-push-cloudflare-workers

## 🚨 최우선 규칙: 프로덕션 서버에 어떠한 변경도 가하지 말 것

이 레포의 **프로덕션 서버는 실제 서비스(연결 앱의 코드푸시 배포)를 운영 중**이다. 프로덕션에 대한 **모든 변경(쓰기) 작업을 금지**한다. 사용자의 **명시적이고 개별적인 지시가 있을 때만** 예외로 허용하며, 그 경우에도 실행 전 반드시 확인을 받는다.

**프로덕션 식별 기준**
- 워커: `code-push-server-preview` (`wrangler.toml [env.production]`)
- URL: `https://code-push-server-preview.yplabs.workers.dev`
- D1: `codepush-server-prod` (id `aee5850e-b85e-47c6-a0fb-782591e47e5d`)
- R2: `code-push-storage`
- Cloudflare 계정: **YP Labs** (`3ed9862a49fe75464126e11a462fd26e`)

### 절대 자동 실행 금지 (프로덕션 변경 작업)
- `wrangler publish --env production` / `wrangler deploy --env production` — **배포**
- `pnpm publish` (= 위와 동일)
- `pnpm apply:production` / `wrangler d1 migrations apply DB --env production --remote` — **마이그레이션**
- `wrangler d1 execute DB --env production --remote --command "INSERT/UPDATE/DELETE/DROP/ALTER ..."` — **DB 쓰기**
- `wrangler secret put|delete ... --env production` — **시크릿 변경**
- `wrangler r2 object put|delete ...` (프로덕션 버킷) — **스토리지 변경**
- `wrangler rollback --env production` — **배포 롤백**
- 프로덕션 대상 관리 API 쓰기 호출(POST/PATCH/DELETE: 앱·배포·릴리즈·promote·rollback 등)

### 허용 (읽기 전용, 그래도 신중히)
- `wrangler d1 execute ... --env production --remote --command "SELECT ..."` (조회)
- `wrangler tail --env production` (로그)
- `curl` 등으로 프로덕션 API **GET** 호출
- `/health`, `/docs` 조회

> 위 "읽기 전용"도 민감 데이터 노출·요금·부하를 유발할 수 있으니 목적이 분명할 때만.

### 작업은 로컬/별도 환경에서
- 개발·검증은 **로컬(`--env local --local`, `.wrangler` 시뮬레이션)**에서 한다.
- 실서버 연결 확인이 꼭 필요하면 **읽기 전용**으로, 인증은 이미 발급된 토큰(CLI `~/.code-push.config`) **재사용**만 하고 새 계정/키를 prod에 만들지 않는다.

---

## 참고 문서 (옵시디언 볼트 `docs/code-push-server/`)
- **코드푸시 서버 실전 가이드** — 실행·배포·운영 (로컬/프로덕션 명령어 포함)
- **코드푸시 서버 레포 구조 레퍼런스** — 내부 구조·API·데이터 모델

## 커밋 컨벤션
- 이 레포 스타일: `수정: ...` / `추가: ...` / `삭제: ...` (한글 접두사).
- 커밋/푸시는 **사용자의 명시적 지시가 있을 때만** 수행한다.

## 웹 인증 방식
`apps/web`은 **GitHub OAuth 세션 쿠키**(httpOnly)로 인증한다. axios `withCredentials: true`로 쿠키를 전송하며, 클라이언트에서 토큰을 저장/주입하지 않는다.
- 쿠키가 XHR에 실리려면 웹이 `VITE_API_URL`과 **동일 오리진**에 배포되어야 한다.
- 서버 콜백(`/auth/github/callback`)이 대시보드로 리다이렉트하도록 하는 수정이 선행되어야 한다(서버 소스 수정 + 배포는 별도).

## 로컬 개발 우회는 커밋 금지
로컬에서 prod-preview에 붙여 확인하려고 넣은 아래 값은 **커밋하지 않는다**(작업 트리에만 유지):
- `apps/web/.env.development` 의 `VITE_API_URL`을 prod-preview로 바꾼 값 (커밋본은 `http://localhost:8787` 유지)
- `apps/web/vite.config.ts` 의 dev 포트 고정
- `apps/web/.env.local` (`*.local` gitignore 유지)
