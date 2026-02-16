#!/usr/bin/env node
/**
 * 텔레메트리 ingest 서버 (포트 7243)
 * 클라이언트에서 가설 검증용 이벤트를 수신합니다.
 */
import express from 'express';
import cors from 'cors';

const PORT = 7243;
const app = express();

app.use(cors());
app.use(express.json());

app.post('/ingest/:experimentId', (req, res) => {
  const { experimentId } = req.params;
  const payload = req.body;
  const time = new Date().toISOString();
  console.log(`[${time}] ingest/${experimentId}`, JSON.stringify(payload, null, 2));
  res.status(204).send();
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n📊 텔레메트리 서버 실행 중: http://127.0.0.1:${PORT}`);
  console.log(`   POST /ingest/:id 로 이벤트 수신\n`);
});
