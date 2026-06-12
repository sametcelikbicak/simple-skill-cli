import { readFile, readdir, stat } from 'node:fs/promises'
import { join, dirname, basename } from 'node:path'
import { tmpdir, homedir } from 'node:os'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'

function isGitHubRef(source) {
  return /^[\w.-]+\/[\w.-]+$/.test(source) && !source.startsWith('/') && !source.startsWith('.')
}

function isLocalPath(source) {
  return source.startsWith('/') || source.startsWith('.') || source.startsWith('~')
}

function parseMetadata(content) {
  const slugMatch = content.match(/^# slug:\s*(\S+)$/m)
  const nameMatch = content.match(/^name:\s*(\S+)$/m)
  const ownerMatch = content.match(/^# owner:\s*(\S+)$/m)

  const name = nameMatch?.[1] || slugMatch?.[1]?.split('/')?.[1] || 'unknown'
  const slug = slugMatch?.[1] || name
  const owner = ownerMatch?.[1] || 'local'

  return { name, slug, owner }
}

async function resolveLocal(source) {
  const expanded = source.replace(/^~/, homedir())
  const st = await stat(expanded)

  let skillDir
  if (st.isDirectory()) {
    skillDir = expanded
  } else if (st.isFile() && basename(expanded) === 'SKILL.md') {
    skillDir = dirname(expanded)
  } else {
    throw new Error(`Source must be a SKILL.md file or a directory containing one`)
  }

  const skillPath = join(skillDir, 'SKILL.md')
  try {
    await stat(skillPath)
  } catch {
    throw new Error(`No SKILL.md found in ${skillDir}`)
  }

  const content = await readFile(skillPath, 'utf-8')
  const meta = parseMetadata(content)

  const dirEntries = await readdir(skillDir, { withFileTypes: true })
  const files = dirEntries.filter(e => e.name !== '.git').map(e => e.name)

  return { ...meta, content, files, skillDir, sourcePath: source, sourceType: 'local' }
}

async function resolveGitHub(source) {
  const tmpDir = join(tmpdir(), `sskill-${randomUUID().slice(0, 8)}`)
  const url = `https://github.com/${source}.git`

  execSync(`git clone --depth 1 "${url}" "${tmpDir}"`, { stdio: 'pipe', timeout: 30000 })

  const skillDirs = []

  function scan(dir, depth = 0) {
    if (depth > 3) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        scan(full, depth + 1)
      } else if (entry.name === 'SKILL.md') {
        const c = readFileSync(full, 'utf-8')
        const meta = parseMetadata(c)
        skillDirs.push({ dir: dirname(full), ...meta, content: c })
      }
    }
  }

  scan(tmpDir)

  if (skillDirs.length === 0) {
    execSync(`rm -rf "${tmpDir}"`)
    throw new Error(`No SKILL.md found in GitHub repo ${source}`)
  }

  const skill = skillDirs[0]
  const files = readdirSync(skill.dir, { withFileTypes: true })
    .filter(e => e.name !== '.git')
    .map(e => e.name)

  execSync(`rm -rf "${tmpDir}"`)

  return { ...skill, files, skillDir: skill.dir, sourcePath: source, sourceType: 'github' }
}

export async function resolveSource(source) {
  if (isGitHubRef(source)) {
    return await resolveGitHub(source)
  }
  if (isLocalPath(source)) {
    return await resolveLocal(source)
  }
  throw new Error(`Invalid source: "${source}". Use a local path (./, /, ~) or GitHub ref (owner/repo)`)
}
