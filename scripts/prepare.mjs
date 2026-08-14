/**
 * Self-contained prepare build for `dsh plugin add github:…`.
 * Bundles src/ → lib/ with the locally installed tsdown; does not typecheck
 * against DSH peers (those exist only after the profile installs this package).
 */
import { existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const require = createRequire(import.meta.url)

function localBin(packageName, relativePath) {
  return join(dirname(require.resolve(`${packageName}/package.json`)), relativePath)
}

const tsdown = localBin('tsdown', 'dist/run.mjs')
if (!existsSync(tsdown)) {
  console.error('prepare: tsdown is not installed; run pnpm install first')
  process.exit(1)
}

mkdirSync(join(root, 'lib'), { recursive: true })
const result = spawnSync(process.execPath, [tsdown, '--config', 'tsdown.prepare.config.ts'], {
  cwd: root,
  stdio: 'inherit',
})
if (result.error) {
  console.error(`prepare: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 1)
