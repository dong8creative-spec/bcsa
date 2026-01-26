#!/bin/bash

# 로컬 테스트 스크립트
# Firebase Emulator가 실행 중이어야 합니다

echo "=== 로컬 Firebase Functions 테스트 ==="
echo ""

# Emulator URL
EMULATOR_URL="http://localhost:5001/bcsa-b190f/asia-northeast3/apiBid"

echo "1. Health Check 테스트"
curl -s "${EMULATOR_URL}/health"
echo -e "\n"

echo "2. 영어 키워드 검색 테스트"
curl -s "${EMULATOR_URL}/api/bid-search?keyword=software&pageNo=1&numOfRows=3" | head -20
echo -e "\n"

echo "3. 한글 키워드 검색 테스트 (URL 인코딩)"
curl -s -G "${EMULATOR_URL}/api/bid-search" \
  --data-urlencode "keyword=소프트웨어" \
  --data-urlencode "pageNo=1" \
  --data-urlencode "numOfRows=3" | head -20
echo -e "\n"

echo "=== 테스트 완료 ==="
echo ""
echo "참고: Firebase Emulator가 실행 중이어야 합니다:"
echo "  firebase emulators:start --only functions"
