import path from 'node:path';
import { createApp } from './server.mjs';
const port = Number(process.env.PORT || 4317);
const host = process.env.HOST || '127.0.0.1';
const origin = process.env.APP_ORIGIN || `http://127.0.0.1:${port}`;
if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !origin.startsWith('https://')) throw Error('Dış ağ dinleme yalnızca HTTPS APP_ORIGIN ile kullanılabilir.');
const app = await createApp({ origin, ...(process.env.DATA_DIR ? { dataDir: path.resolve(process.env.DATA_DIR) } : {}) });
app.server.listen(port, host, () => {
  console.log(`Yerel konsol: ${origin}`);
  if (app.setupToken) console.log(`İlk yönetici kurulumu (30 dakika, tek kullanım): ${origin}/#setup=${app.setupToken}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
