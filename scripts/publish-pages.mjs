// ينشر مجلد frontend/ على فرع gh-pages (يعمل مع GitHub Pages بدون صلاحية workflow).
// الاستخدام: npm run deploy:pages        (اختيارياً: API_BASE=https://treading.onrender.com)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (args, opts = {}) =>
  execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', ...opts }).trim();

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'treading-pages-'));
fs.cpSync(path.join(repo, 'frontend'), tmp, { recursive: true });
fs.writeFileSync(path.join(tmp, '.nojekyll'), '');
const apiBase = (process.env.API_BASE || '').replace(/\/+$/, '');
fs.writeFileSync(path.join(tmp, 'js', 'config.js'), `window.GTJ_CONFIG = { apiBase: ${JSON.stringify(apiBase)} };\n`);

// فهرس مؤقت منفصل حتى لا نلمس ملفات العمل ولا فهرس الفرع الحالي
const index = path.join(tmp, '..', `treading-index-${process.pid}`);
const env = { ...process.env, GIT_INDEX_FILE: index, GIT_WORK_TREE: tmp };
git(['add', '-A', '-f', '.'], { env, cwd: tmp });
const tree = git(['write-tree'], { env });
const sha = git(['rev-parse', '--short', 'HEAD']);
const commit = git(['commit-tree', tree, '-m', `Deploy frontend from ${sha}`], { env });
git(['push', '--force', 'origin', `${commit}:refs/heads/gh-pages`], { stdio: 'inherit' });

fs.rmSync(tmp, { recursive: true, force: true });
fs.rmSync(index, { force: true });
console.log(`نُشر gh-pages (${commit.slice(0, 7)}) — apiBase: ${apiBase || '(فارغ)'}`);
