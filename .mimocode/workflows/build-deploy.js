export const meta = {
  name: "build-deploy",
  description: "Build the GullDock plugin, validate the output, and deploy to the Obsidian vault.",
}

export default async function buildDeploy(args) {
  const vaultPath = args?.vault_path || undefined

  phase("Build")
  const buildResult = await agent(
    `Run the production build for the GullDock Obsidian plugin. Execute: node esbuild.config.mjs production\nin the project root. Report success/failure and any errors. If it fails, stop here with a clear error message.`
  )

  if (buildResult?.includes("failed") || buildResult?.includes("error")) {
    return `Build failed — aborting deploy.\n\n${buildResult}`
  }

  phase("Validate")
  const validateResult = await agent(
    `Check that the build output exists and is valid:\n1. Read main.js and confirm it's non-empty\n2. Read manifest.json and confirm it has required fields (id, name, version)\n3. Check if styles.css exists (optional)\nReport any issues.`
  )

  if (validateResult?.includes("missing") || validateResult?.includes("invalid")) {
    return `Validation failed — aborting deploy.\n\n${validateResult}`
  }

  phase("Deploy")
  const deployResult = await agent(
    vaultPath
      ? `Deploy the built plugin files (main.js, manifest.json, styles.css) to the Obsidian vault plugin directory at: ${vaultPath}. Copy each file.`
      : `Deploy the built plugin. Scan C:\\ through F:\\ for .obsidian/plugins/axlumen-dashboard/ and copy main.js, manifest.json, styles.css there.`
  )

  return `Build → Validate → Deploy complete.\n\n${deployResult}`
}
