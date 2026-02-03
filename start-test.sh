#!/usr/bin/env bash
# 로컬 테스트 서버 실행 스크립트
# 모든 기능을 임의로 테스트할 수 있습니다.

set -e

cd "$(dirname "$0")"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║   🚀 부산청년사업가들 웹사이트 로컬 테스트 서버 시작        ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "📂 프로젝트 폴더: $(pwd)"
echo ""

# 포트 확인 함수
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 1  # 포트 사용 중
    else
        return 0  # 포트 사용 가능
    fi
}

# 3000 포트 확인
PORT=3000
if ! check_port $PORT; then
    echo "⚠️  포트 $PORT 이 이미 사용 중입니다."
    echo "    대체 포트 5173을 사용합니다."
    PORT=5173
    
    if ! check_port $PORT; then
        echo "⚠️  포트 $PORT 도 사용 중입니다."
        echo "    사용 가능한 랜덤 포트를 찾습니다..."
        PORT=0  # Vite가 자동으로 포트 선택
    fi
fi

echo ""
echo "✅ 개발 서버를 시작합니다..."
echo ""
echo "📝 테스트 가이드: 로컬_테스트_가이드.md 파일을 참고하세요"
echo ""
echo "🌐 브라우저 접속 주소:"
if [ "$PORT" = "0" ]; then
    echo "    (서버 시작 후 표시되는 주소를 사용하세요)"
elif [ "$PORT" = "3000" ]; then
    echo "    http://127.0.0.1:3000"
else
    echo "    http://127.0.0.1:$PORT"
fi
echo ""
echo "🛑 서버 종료: Ctrl + C"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Vite 개발 서버 실행
if [ "$PORT" = "0" ]; then
    npx vite --host 127.0.0.1
else
    npx vite --port $PORT --host 127.0.0.1
fi
