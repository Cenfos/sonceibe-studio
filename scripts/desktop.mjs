import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const mode = process.argv[2] || 'build';
if (!['dev', 'build'].includes(mode)) throw new Error('Use dev or build');
let config;
if (mode === 'build') {
  const url = new URL(process.env.STUDIO_DESKTOP_URL || '');
  if (url.protocol !== 'https:' || url.hostname.endsWith('.invalid')) throw new Error('STUDIO_DESKTOP_URL debe ser la URL HTTPS de Studio');
  config = 'src-tauri/desktop.generated.json';
  writeFileSync(config, JSON.stringify({ build: { frontendDist: url.href } }));
}
const result = spawnSync('cargo', ['tauri', mode, ...(config ? ['--config', config] : [])], { stdio: 'inherit', shell: false });
if (result.error) console.error('Instala Rust, las herramientas C++ de Visual Studio y cargo install tauri-cli --version "^2"', result.error.message);
process.exit(result.status ?? 1);
