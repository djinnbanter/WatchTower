/**
 * Capture dashboard screenshots via CDP JSON dumps written by browser MCP,
 * OR navigate locally with playwright if available.
 * This helper decodes a CDP captureScreenshot JSON into a PNG path.
 */
import fs from 'node:fs';
import path from 'node:path';

const [,, jsonPath, outPath] = process.argv;
if (!jsonPath || !outPath) {
  console.error('Usage: node decode-cdp-shot.mjs <cdp-json> <out.png>');
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const data = raw.data || raw.result?.data;
if (!data) {
  console.error('No base64 data in', jsonPath, Object.keys(raw));
  process.exit(1);
}
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
console.log('Wrote', outPath, fs.statSync(outPath).size, 'bytes');
