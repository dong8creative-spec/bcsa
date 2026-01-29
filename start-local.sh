#!/usr/bin/env bash
# 로컬 개발 서버 실행 (입찰공고 등 전체 기능 테스트용)
# 사용: ./start-local.sh 또는 bash start-local.sh

cd "$(dirname "$0")"
echo "▶ 프로젝트 폴더: $(pwd)"
echo "▶ 개발 서버 시작 중... (종료: Ctrl+C)"
echo "▶ 브라우저에서 http://127.0.0.1:3000 접속 후 메뉴 '입찰공고' 클릭"
echo ""
npm run dev
