import { tool } from "@mimo-ai/plugin"
import { execSync } from 'child_process'
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'

const PLUGIN_ID = 'axlumen-dashboard'
const FILES_TO_COPY = ['manifest.json', 'main.js', 'styles.css']

function findPluginDir(root: string): string[] {
  const candidates: string[] = []
  try {
    for (const entry of readdirSync(root)) {
      if (entry.startsWith('.') || entry.startsWith('$')) continue
      const fullPath = join(root, entry)
      try {
        if (!statSync(fullPath).isDirectory()) continue
      } catch { continue }

      const dotObsidian = join(fullPath, '.obsidian')
      if (existsSync(dotObsidian)) {
        const pluginDir = join(dotObsidian, 'plugins', PLUGIN_ID)
        if (existsSync(pluginDir)) {
          candidates.push(pluginDir)
        }
      }

      try {
        for (const sub of readdirSync(fullPath)) {
          if (sub.startsWith('.') || sub.startsWith('$')) continue
          const subPath = join(fullPath, sub)
          try {
            if (!statSync(subPath).isDirectory()) continue
          } catch { continue }
          const subDotObsidian = join(subPath, '.obsidian')
          if (existsSync(subDotObsidian)) {
            const subPluginDir = join(subDotObsidian, 'plugins', PLUGIN_ID)
            if (existsSync(subPluginDir)) {
              candidates.push(subPluginDir)
            }
          }
        }
      } catch {}
    }
  } catch {}
  return candidates
}

export default tool({
  description: "Build the Obsidian plugin and deploy it to the vault directory. Scans all drives for the plugin folder.",
  args: {
    skip_build: tool.schema.boolean().optional().describe("Skip the esbuild step and just copy files"),
    vault_path: tool.schema.string().optional().describe("Explicit vault plugin dir path to deploy to (skip auto-scan)"),
  },
  async execute(args, ctx) {
    const workdir = ctx.worktree

    // Step 1: Build
    if (!args.skip_build) {
      try {
        execSync('node esbuild.config.mjs production', { cwd: workdir, stdio: 'pipe' })
      } catch (e: any) {
        return `❌ Build failed:\n${e.stderr || e.message}`
      }
    }

    // Step 2: Find or use provided vault path
    let pluginDir: string | null = args.vault_path || null

    if (!pluginDir) {
      const drives = ['C:\\', 'D:\\', 'E:\\', 'F:\\']
      for (const drive of drives) {
        if (!existsSync(drive)) continue
        const found = findPluginDir(drive)
        if (found.length > 0) {
          pluginDir = found[0]
          break
        }
      }
    }

    if (!pluginDir) {
      return '❌ Could not find .obsidian/plugins/' + PLUGIN_ID + '/. Create the folder manually or pass vault_path.'
    }

    // Step 3: Copy
    let copied = 0
    const results: string[] = []
    for (const file of FILES_TO_COPY) {
      const src = join(workdir, file)
      const dst = join(pluginDir, file)
      if (!existsSync(src)) {
        results.push(`⚠️  Source not found: ${file}`)
        continue
      }
      copyFileSync(src, dst)
      results.push(`✅ ${file}`)
      copied++
    }

    return `Deployed ${copied}/${FILES_TO_COPY.length} files to:\n${pluginDir}\n\n${results.join('\n')}\n\nReload Obsidian (Ctrl+P → "Reload app without saving") to apply.`
  },
})
