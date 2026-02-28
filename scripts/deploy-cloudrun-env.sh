#!/usr/bin/env bash
# Cloud Run 환경 변수 주입 배포 스크립트 초안
# 사용: ./scripts/deploy-cloudrun-env.sh
# 필요: gcloud CLI 로그인 및 프로젝트 설정 완료

set -e

PROJECT_ID="${GCP_PROJECT_ID:-bcsa-b190f}"
REGION="${GCP_REGION:-asia-northeast3}"
# Firebase Functions v2로 배포된 Cloud Run 서비스명
# 확인: gcloud run services list --project=$PROJECT_ID --region=$REGION
SERVICE_NAME="${CLOUD_RUN_SERVICE:-apibid}"

# functions/.env에서 변수 로드 (있으면 사용)
ENV_FILE="functions/.env"
if [[ -f "$ENV_FILE" ]]; then
  echo "Loading env from $ENV_FILE (exported vars only, no inline comments)"
  set -a
  source "$ENV_FILE" 2>/dev/null || true
  set +a
fi

# 필수 환경 변수 (미설정 시 빈 문자열로 전달되지 않도록 체크)
KAKAO_REST_API_KEY="${KAKAO_REST_API_KEY:-}"
KAKAO_CLIENT_SECRET="${KAKAO_CLIENT_SECRET:-}"
FRONTEND_URL="${FRONTEND_URL:-https://bcsa.co.kr}"

if [[ -z "$KAKAO_REST_API_KEY" || -z "$KAKAO_CLIENT_SECRET" ]]; then
  echo "Error: KAKAO_REST_API_KEY and KAKAO_CLIENT_SECRET must be set (in env or $ENV_FILE)"
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
