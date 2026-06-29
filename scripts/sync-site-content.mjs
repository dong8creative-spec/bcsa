#!/usr/bin/env node
/**
 * Firestore siteContent/main → src/constants/publishedContent.json 동기화
 *
 * 실행 전 (로컬):
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *
 * 실행:
 *   npm run sync-content
 */

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '../src/constants/publishedContent.json');

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  const db = admin.firestore();
  const snap = await db.collection('siteContent').doc('main').get();
  const content = snap.exists ? (snap.data()?.content || {}) : {};

  writeFileSync(outPath, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
  console.log(`[sync-site-content] wrote ${Object.keys(content).length} top-level keys → ${outPath}`);
}

main().catch((err) => {
  console.error('[sync-site-content] failed:', err.message || err);
  process.exit(1);
});
