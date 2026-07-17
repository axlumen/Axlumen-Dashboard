/**
 * deploy.mjs — 构建 + 自动部署到 Obsidian vault 的插件目录
 *
 * 用法: node deploy.mjs
 *
 * 流程:
 *   1. esbuild 生产构建
 *   2. 扫描所有盘符找到 .obsidian/plugins/axlumen-dashboard/
 *   3. 复制 manifest.json + main.js + styles.css
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const PLUGIN_ID = 'axlumen-dashboard';
const FILES_TO_COPY = ['manifest.json', 'main.js', 'styles.css'];

// ── 1. Build ──────────────────────────────────────────────────────
console.log('🔨 Building...');
try {
  execSync('node esbuild.config.mjs production', { cwd: __dirname, stdio: 'inherit' });
} catch {
  console.error('❌ Build failed');
  process.exit(1);
}

// ── 2. Find vault plugin dir ──────────────────────────────────────
console.log('🔍 Scanning for Obsidian vaults...');

function findPluginDir(root) {
  const candidates = [];
  try {
    for (const entry of readdirSync(root)) {
      if (entry.startsWith('.') || entry.startsWith('$')) continue;
      const fullPath = join(root, entry);
      try {
        if (!statSync(fullPath).isDirectory()) continue;
      } catch { continue; }

      // Check if this is an Obsidian vault
      const dotObsidian = join(fullPath, '.obsidian');
      if (existsSync(dotObsidian)) {
        const pluginDir = join(dotObsidian, 'plugins', PLUGIN_ID);
        if (existsSync(pluginDir)) {
          candidates.push(pluginDir);
        }
      }

      // Recurse 2 levels deep
      try {
        for (const sub of readdirSync(fullPath)) {
          if (sub.startsWith('.') || sub.startsWith('$')) continue;
          const subPath = join(fullPath, sub);
          try {
            if (!statSync(subPath).isDirectory()) continue;
          } catch { continue; }
          const subDotObsidian = join(subPath, '.obsidian');
          if (existsSync(subDotObsidian)) {
            const subPluginDir = join(subDotObsidian, 'plugins', PLUGIN_ID);
            if (existsSync(subPluginDir)) {
              candidates.push(subPluginDir);
            }
          }
        }
      } catch {}
    }
  } catch {}
  return candidates;
}

const drives = ['C:\\', 'D:\\', 'E:\\', 'F:\\'];
let pluginDir = null;

for (const drive of drives) {
  if (!existsSync(drive)) continue;
  const found = findPluginDir(drive);
  if (found.length > 0) {
    pluginDir = found[0];
    break;
  }
}

if (!pluginDir) {
  console.error('❌ Could not find .obsidian/plugins/' + PLUGIN_ID + '/');
  console.error('   Make sure the plugin folder exists in your vault.');
  console.error('   You can create it manually and re-run this script.');
  process.exit(1);
}

// ── 3. Copy files ─────────────────────────────────────────────────
console.log('📁 Deploying to: ' + pluginDir);
let copied = 0;

for (const file of FILES_TO_COPY) {
  const src = join(__dirname, file);
  const dst = join(pluginDir, file);
  if (!existsSync(src)) {
    console.warn('⚠️  Source not found: ' + file);
    continue;
  }
  copyFileSync(src, dst);
  console.log('   ✅ ' + file);
  copied++;
}

console.log(`\n🎉 Deployed ${copied}/${FILES_TO_COPY.length} files to:\n   ${pluginDir}`);
console.log('   Reload Obsidian (Ctrl+P → "Reload app without saving") to apply.');
