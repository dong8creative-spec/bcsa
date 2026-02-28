#!/usr/bin/env bash
# Cloud Run 환경 변수 주입 배포 스크립트 초안
# 사용: ./scripts/deploy-cloudrun-env.sh
# 필요: gcloud CLI 로그인 및 프로젝트 설정 완료

set -e

# 스크립트 기준으로 프로젝트 루트로 이동 (npm run 시 cwd가 루트여도 경로 통일)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

PROJECT_ID="${GCP_PROJECT_ID:-bcsa-b190f}"
REGION="${GCP_REGION:-asia-northeast3}"
# Firebase Functions v2로 배포된 Cloud Run 서비스명
# 확인: gcloud run services list --project=$PROJECT_ID --region=$REGION
SERVICE_NAME="${CLOUD_RUN_SERVICE:-apibid}"

# functions/.env에서 변수 로드 (KEY=value 줄만 추려 source)
ENV_FILE="$ROOT_DIR/functions/.env"
if [[ -f "$ENV_FILE" ]]; then
  echo "Loading env from $ENV_FILE"
  tmp_env=$(mktemp)
  grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" | sed 's/^export[[:space:]]*//' | tr -d '\r' > "$tmp_env"
  set -a
  source "$tmp_env" 2>/dev/null || true
  set +a
  rm -f "$tmp_env"
fi

# 필수 환경 변수 (다른 이름으로 넣었을 수 있음)
KAKAO_REST_API_KEY="${KAKAO_REST_API_KEY:-${KAKAO_JS_KEY:-}}"
KAKAO_CLIENT_SECRET="${KAKAO_CLIENT_SECRET:-}"
FRONTEND_URL="${FRONTEND_URL:-https://bcsa.co.kr}"

if [[ -z "$KAKAO_REST_API_KEY" || -z "$KAKAO_CLIENT_SECRET" ]]; then
  echo "Error: KAKAO_REST_API_KEY and KAKAO_CLIENT_SECRET must be set (in env or $ENV_FILE)"
  echo "  Check that $ENV_FILE contains exactly: KAKAO_REST_API_KEY=..., KAKAO_CLIENT_SECRET=..."
  echo "  (no spaces around =, one per line)"
  exit 1
fi

# Cloud Run 서비스에 환경 변수 주입 (새 리비전 생성)
# --set-env-vars: 기존 변수에 덮어쓰기
ENV_VARS="KAKAO_REST_API_KEY=${KAKAO_REST_API_KEY},KAKAO_CLIENT_SECRET=${KAKAO_CLIENT_SECRET},FRONTEND_URL=${FRONTEND_URL}"

echo "Updating Cloud Run service: $SERVICE_NAME in $REGION (project: $PROJECT_ID)"
gcloud run services update "$SERVICE_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --set-env-vars="$ENV_VARS" \
  --platform=managed

echo "Done. Env vars applied to latest revision."
