#!/usr/bin/env python3
"""
공공데이터 API CORS 프록시 서버
"""
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs, unquote
import urllib.request
import sys

PORT = 3000

class CORSProxyHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        try:
            # URL 파라미터에서 target URL 추출
            parsed_path = urlparse(self.path)
            query_params = parse_qs(parsed_path.query)
            
            if 'url' not in query_params:
                self.send_error(400, 'Missing url parameter')
                return
            
            target_url = unquote(query_params['url'][0])
            print(f'[프록시 요청] {target_url}')
            
            # 타겟 URL로 요청
            req = urllib.request.Request(target_url)
            with urllib.request.urlopen(req) as response:
                content = response.read()
                content_type = response.headers.get('Content-Type', 'application/json')
                
                # 응답 전송
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', content_type)
                self.end_headers()
                self.wfile.write(content)
                
                print(f'[프록시 성공] Status: 200, Size: {len(content)} bytes')
                
        except Exception as e:
            print(f'[프록시 에러] {str(e)}')
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_msg = f'{{"error": "{str(e)}"}}'
            self.wfile.write(error_msg.encode())

    def log_message(self, format, *args):
        # 기본 로그 메시지 억제 (우리가 직접 출력함)
        pass

def run_server():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, CORSProxyHandler)
    
    print('=' * 50)
    print('공공데이터 API CORS 프록시 서버 실행 중')
    print(f'포트: {PORT}')
    print('=' * 50)
    print(f'\n사용 방법: http://localhost:{PORT}/?url=YOUR_API_URL')
    print('\n서버를 중지하려면 Ctrl+C를 누르세요\n')
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n\n서버를 종료합니다.')
        httpd.server_close()
        sys.exit(0)

if __name__ == '__main__':
    run_server()

