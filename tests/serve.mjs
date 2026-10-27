import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
await mkdir('tests/.generated', { recursive: true });
await build({ entryPoints: ['tests/browser-entry.tsx'], bundle: true, outfile: 'tests/.generated/bundle.js', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'process.env.__NEXT_IMAGE_OPTS': 'undefined' } });
const css = await postcss([tailwind('./tailwind.config.ts')]).process(await readFile('app/globals.css', 'utf8'), { from: 'app/globals.css' });
await writeFile('tests/.generated/styles.css', css.css);
createServer(async (request, response) => {
  if (request.url === '/bundle.js' || request.url === '/styles.css') {
    response.setHeader('Content-Type', request.url.endsWith('.js') ? 'text/javascript' : 'text/css');
    response.end(await readFile(`tests/.generated${request.url}`));
  } else if (request.url?.startsWith('/api/')) { response.setHeader('Content-Type', 'application/json'); response.end('{}'); }
  else { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><html class="dark"><head><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
}).listen(4174, '127.0.0.1');
