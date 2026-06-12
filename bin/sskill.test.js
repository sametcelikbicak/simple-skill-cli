import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let tempDir, sskillModule, origArgv, origExit

before(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'sskill-cli-test-'))
  process.env.HOME = tempDir
  await mkdir(join(tempDir, '.agents'), { recursive: true })

  origArgv = process.argv
  origExit = process.exit
  sskillModule = await import('./sskill.js')
})

after(async () => {
  process.exit = origExit
  process.argv = origArgv
  await rm(tempDir, { recursive: true, force: true })
})

function capture(name, obj = console) {
  const logs = []
  const orig = obj[name]
  obj[name] = (...args) => {
    if (args.length) logs.push(String(args[0]))
  }
  return { logs, restore: () => { obj[name] = orig } }
}

function mockExit() {
  const orig = process.exit
  process.exit = (code) => { throw new Error(`exit:${code}`) }
  return () => { process.exit = orig }
}

describe('sskill CLI', () => {
  it('shows usage for help command', async () => {
    process.argv = ['node', 'sskill', 'help']
    const { logs, restore } = capture('log')

    await sskillModule.main()

    assert.ok(logs.some(l => l.includes('sskill')))
    restore()
  })

  it('shows usage for --help flag', async () => {
    process.argv = ['node', 'sskill', '--help']
    const { logs, restore } = capture('log')

    await sskillModule.main()

    assert.ok(logs.some(l => l.includes('sskill')))
    restore()
  })

  it('shows usage for unknown command', async () => {
    process.argv = ['node', 'sskill', 'unknown']
    const { logs, restore } = capture('log')

    await sskillModule.main()

    assert.ok(logs.some(l => l.includes('sskill')))
    restore()
  })

  it('errors when install has no source', async () => {
    process.argv = ['node', 'sskill', 'install']
    const { logs: errors, restore: restoreErr } = capture('error')
    const restoreExit = mockExit()

    try {
      await sskillModule.main()
    } catch (e) {
      assert.ok(e.message.includes('exit:1'))
    }

    assert.ok(errors.some(e => e.includes('Usage: sskill install <source>')))
    restoreErr()
    restoreExit()
  })

  it('runs install with --global flag', async () => {
    const skillDir = join(tempDir, 'my-cli-skill')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), '# slug: cli/cli-skill\nname: cli-skill\nContent')

    process.argv = ['node', 'sskill', 'install', skillDir, '--global']
    const { logs, restore } = capture('log')

    await sskillModule.main()

    assert.ok(logs.some(l => l.includes('Installed')))
    restore()
  })

  it('errors when remove has no slug', async () => {
    process.argv = ['node', 'sskill', 'remove']
    const { logs: errors, restore: restoreErr } = capture('error')
    const restoreExit = mockExit()

    try {
      await sskillModule.main()
    } catch (e) {
      assert.ok(e.message.includes('exit:1'))
    }

    assert.ok(errors.some(e => e.includes('Usage: sskill remove <slug>')))
    restoreErr()
    restoreExit()
  })

  it('dispatches list command without errors', async () => {
    process.argv = ['node', 'sskill', 'list']

    await sskillModule.main()

    // If it reaches here without throwing, dispatch worked
    assert.ok(true)
  })

  it('runs remove command with existing skill', async () => {
    const skillDir = join(tempDir, 'removable-skill')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), '# slug: test/removable\nname: removable\nContent')

    process.argv = ['node', 'sskill', 'install', skillDir, '--global']
    await sskillModule.main()

    process.argv = ['node', 'sskill', 'remove', 'test/removable']
    const { logs, restore } = capture('log')

    await sskillModule.main()

    assert.ok(logs.some(l => l.includes('Removed')))
    restore()
  })

  it('runs remove command with nonexistent skill', async () => {
    process.argv = ['node', 'sskill', 'remove', 'nonexistent']
    const { logs: errors, restore: restoreErr } = capture('error')
    const restoreExit = mockExit()

    try {
      await sskillModule.main()
    } catch (e) {
      assert.ok(e.message.includes('exit:1'))
    }

    assert.ok(errors.some(e => e.includes('not found')))
    restoreErr()
    restoreExit()
  })

  it('run() catches errors', async () => {
    process.argv = ['node', 'sskill', 'install']
    const { logs: errors, restore: restoreErr } = capture('error')
    const restoreExit = mockExit()

    try {
      await sskillModule.run()
    } catch (e) {
      assert.ok(e.message.includes('exit:1'))
    }

    assert.ok(errors.some(e => e.includes('Usage: sskill install <source>')))
    restoreErr()
    restoreExit()
  })
})
