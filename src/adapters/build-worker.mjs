import { parentPort, workerData } from 'node:worker_threads';
// Only a server-created URL from the allowlisted, hash-verified adapter reaches here.
await import(workerData.entry);
parentPort.postMessage({ ok: true });
