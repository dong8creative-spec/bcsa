const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3000;

const server = http.createServer((req, res) => {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // URL 파라미터에서 target URL 추출
    const parsedUrl = url.parse(req.url, true);
    const targetUrl = parsedUrl.query.url;

    if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing url parameter' }));
        return;
    }

    console.log(`[${new Date().toISOString()}] Proxying: ${targetUrl}`);

    // 타겟 URL로 요청
    https.get(targetUrl, (apiRes) => {
        let data = '';

        apiRes.on('data', (chunk) => {
            data += chunk;
        });

        apiRes.on('end', () => {
            res.writeHead(apiRes.statusCode, {
                'Content-Type': apiRes.headers['content-type'] || 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(data);
        });
    }).on('error', (err) => {
        console.error('Proxy error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
    });
});

server.listen(PORT, () => {
    console.log(`\n================================`);
    console.log(`CORS Proxy Server 실행 중`);
    console.log(`포트: ${PORT}`);
    console.log(`================================\n`);
    console.log(`사용 방법: http://localhost:${PORT}/?url=YOUR_API_URL`);
    console.log(`\n서버를 중지하려면 Ctrl+C를 누르세요\n`);
});

