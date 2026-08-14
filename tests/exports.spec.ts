import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

describe('loader namespace (source text)', () => {
  it('does not export default (Cordis unwraps default ?? exports)', () => {
    const source = readFileSync(join(root, 'src/index.ts'), 'utf8')
    expect(source).not.toMatch(/export default/)
    expect(source).toMatch(/export const name = 'llm-oauth'/)
    expect(source).toMatch(/export const inject = \['llm'\]/)
    expect(source).toMatch(/export \{ apply \}/)
  })

  it('declares a dsh.bundle patch', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      dsh?: { bundle?: { patch?: string } }
    }
    expect(pkg.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
  })
})
