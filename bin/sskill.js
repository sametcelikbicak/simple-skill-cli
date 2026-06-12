#!/usr/bin/env node

import { installCommand } from '../src/commands/install.js'
import { listCommand } from '../src/commands/list.js'
import { removeCommand } from '../src/commands/remove.js'

function usage() {
  console.log(`
sskill — Simple Skill CLI

Install AI agent skills directly from local paths or GitHub repos.
Zero dependencies, no marketplace required.

Usage:
  sskill install <source>         Install a skill (local path or owner/repo)
  sskill list                     List installed skills
  sskill remove <slug>            Remove a skill
  sskill help                     Show this help

Options for install:
  --global     Install to ~/.agents/skills/ (default)
  --claude     Also install to ~/.claude/skills/
  --project    Install to ./.agents/skills/
  --all        Install to all locations

Examples:
  sskill install ./my-skill
  sskill install sametcelikbicak/task-decomposer
  sskill install ./skills/my-skill --claude
  sskill list
  sskill remove task-decomposer
`)
}

export async function main() {
  const [,, cmd, ...args] = process.argv
  switch (cmd) {
    case 'install': {
      const source = args[0]
      if (!source) {
        console.error('Usage: sskill install <source>')
        console.error('Source can be a local path (./, /, ~) or a GitHub ref (owner/repo)')
        process.exit(1)
      }

      const flags = args.slice(1)
      const hasAnyFlag = flags.some(f => ['--global', '--project', '--claude', '--all'].includes(f))
      const options = hasAnyFlag ? {
        global: flags.includes('--global') || flags.includes('--all'),
        claude: flags.includes('--claude') || flags.includes('--all'),
        project: flags.includes('--project') || flags.includes('--all'),
      } : {}

      await installCommand(source, options)
      break
    }

    case 'list':
      await listCommand()
      break

    case 'remove': {
      const slug = args[0]
      if (!slug) {
        console.error('Usage: sskill remove <slug>')
        process.exit(1)
      }
      await removeCommand(slug)
      break
    }

    case 'help':
    case '--help':
    case '-h':
    default:
      usage()
      break
  }
}

import { fileURLToPath } from 'node:url'

export async function run() {
  try {
    await main()
  } catch (err) {
    console.error(`Error: ${err.message}`)
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run()
}
