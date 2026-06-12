import { readFile, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

const LOCK_PATH = join(homedir(), '.agents', '.skill-lock.json')
const AGENTS_DIR = join(homedir(), '.agents', 'skills')
const CLAUDE_DIR = join(homedir(), '.claude', 'skills')

export function getLockPath() {
  return LOCK_PATH
}

export function getAgentsDir() {
  return AGENTS_DIR
}

export function getClaudeDir() {
  return CLAUDE_DIR
}

export async function readLock() {
  try {
    await access(LOCK_PATH)
    const raw = await readFile(LOCK_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { version: 3, skills: {}, dismissed: {}, lastSelectedAgents: [] }
  }
}

export async function writeLock(data) {
  await writeFile(LOCK_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

export async function addSkillToLock(slug, entry) {
  const lock = await readLock()
  lock.skills[slug] = { ...entry, installedAt: new Date().toISOString() }
  await writeLock(lock)
  return lock
}

export async function removeSkillFromLock(slug) {
  const lock = await readLock()
  delete lock.skills[slug]
  await writeLock(lock)
  return lock
}
