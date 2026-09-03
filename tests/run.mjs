// 无头测试运行器：提取 tests/*.html 测试页内的模块脚本，在 Node 中执行
// 用法：node tests/run.mjs
// 测试逻辑以 HTML 页为准（§4 测试约定：浏览器打开即运行），
// 本脚本让同一套断言在无浏览器环境也能跑（CI / 快速验证）

import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const files = ['mesh.test.html', 'rules.test.html'];
let allOk = true;

for (const f of files) {
  const html = readFileSync(join(dir, f), 'utf8');
  const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!m) {
    console.error(`${f}: 未找到模块脚本`);
    allOk = false;
    continue;
  }

  const tmp = join(dir, `.tmp-run-${f.replace('.html', '.mjs')}`);
  writeFileSync(tmp, m[1]);
  const r = spawnSync(process.execPath, [tmp], { encoding: 'utf8' });
  rmSync(tmp, { force: true });

  console.log(`──── ${f} ────`);
  console.log(r.stdout.trimEnd());
  if (r.stderr.trim()) console.error(r.stderr.trimEnd());
  if (r.status !== 0) allOk = false;
  console.log('');
}

console.log(allOk ? '全部测试通过' : '存在失败测试');
process.exit(allOk ? 0 : 1);
