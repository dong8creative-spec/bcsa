import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const VIRTUAL_ID = '\0virtual:public-partners';
const RESOLVED_VIRTUAL = 'virtual:public-partners';

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);

function scanPublicPartners(publicPartnersDir) {
  if (!fs.existsSync(publicPartnersDir)) return [];
  const out = [];
  for (const file of fs.readdirSync(publicPartnersDir)) {
    const ext = path.extname(file).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    const stem = path.basename(file, ext);
    const m = stem.match(/partner[_\s-]*(\d+)/i);
    if (!m) continue;
    out.push({
      n: parseInt(m[1], 10),
      path: `assets/images/partners/${file}`,
    });
  }
  out.sort((a, b) => a.n - b.n);
  return out;
}

/**
 * public/assets/images/partners 안의 partner{N}.* 를 빌드 시점에 읽어
 * import.meta.glob 에 안 잡히는 파일도 URL로 쓸 수 있게 합니다.
 */
export function publicPartnersPlugin() {
  const rootDir = path.dirname(fileURLToPath(import.meta.url));
  const partnersDir = path.join(rootDir, '..', 'public', 'assets', 'images', 'partners');

  return {
    name: 'virtual-public-partners',
    resolveId(id) {
      if (id === RESOLVED_VIRTUAL) return VIRTUAL_ID;
    },
    load(id) {
      if (id !== VIRTUAL_ID) return null;
      const entries = scanPublicPartners(partnersDir);
      return `export const PUBLIC_PARTNER_ENTRIES = ${JSON.stringify(entries)};\n`;
    },
    configureServer(server) {
      server.watcher.add(partnersDir);
      const invalidate = () => {
        const mod = server.moduleGraph.getModuleById(VIRTUAL_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
      };
      server.watcher.on('add', (file) => {
        if (file.startsWith(partnersDir)) invalidate();
      });
      server.watcher.on('unlink', (file) => {
        if (file.startsWith(partnersDir)) invalidate();
      });
    },
  };
}
