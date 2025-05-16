## Description
- 코드 푸시 서버 애플리케이션입니다.

## Prerequisites
- Node.js 18.x 이상
- Cloudflare 계정
- Cloudflare R2 버킷
- Cloudflare D1 데이터베이스


## Secrets
- 해당 어플리케이션에서 사용하는 비밀키는 .env.example에서 확인할 수 있습니다.
- production 환경에서 사용하는 환경변수 파일은 서버 담당자에게 문의해주세요.
- 비밀키를 추가하기 위해서는 다음 명령어를 실행합니다.

``` sh
wrangler secret put key
```

## Deployment
- main 브랜치에 푸시 시 자동으로 배포됩니다.
현재 production 환경: https://code-push-server-preview.yplabs.workers.dev
