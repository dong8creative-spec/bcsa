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
  # 줄 끝 \r 제거 후 KEY=value로 시작하는 줄만 (앞뒤 공백 제거)
  while IFS= read -r line; do
    line="${line//$'\r'/}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    line="${line#export }"; line="${line#export}"
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      echo "$line" >> "$tmp_env"
    fi
  done < "$ENV_FILE"
  if [[ -s "$tmp_env" ]]; then
    set -a
    source "$tmp_env" 2>/dev/null || true
    set +a
  fi
  rm -f "$tmp_env"
fi

# 필수: KAKAO_REST_API_KEY. 선택: KAKAO_CLIENT_SECRET (카카오에서 클라이언트 시크릿 사용 시에만)
KAKAO_REST_API_KEY="${KAKAO_REST_API_KEY:-${KAKAO_JS_KEY:-}}"
KAKAO_CLIENT_SECRET="${KAKAO_CLIENT_SECRET:-}"
FRONTEND_URL="${FRONTEND_URL:-https://bcsa.co.kr}"

if [[ -z "$KAKAO_REST_API_KEY" ]]; then
  echo "Error: KAKAO_REST_API_KEY must be set (in env or $ENV_FILE)"
  exit 1
fi

# Cloud Run 서비스에 환경 변수 주입 (새 리비전 생성)
ENV_VARS="KAKAO_REST_API_KEY=${KAKAO_REST_API_KEY},FRONTEND_URL=${FRONTEND_URL}"
[[ -n "$KAKAO_CLIENT_SECRET" ]] && ENV_VARS="${ENV_VARS},KAKAO_CLIENT_SECRET=${KAKAO_CLIENT_SECRET}"

echo "Updating Cloud Run service: $SERVICE_NAME in $REGION (project: $PROJECT_ID)"
gcloud run services update "$SERVICE_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --set-env-vars="$ENV_VARS" \
  --platform=managed

echo "Done. Env vars applied to latest revision."
