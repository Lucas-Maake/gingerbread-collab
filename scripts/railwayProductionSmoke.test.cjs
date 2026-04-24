const { spawn } = require('node:child_process')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')
const { existsSync } = require('node:fs')
const { mkdtemp, rm } = require('node:fs/promises')
const { setTimeout: delay } = require('node:timers/promises')
const assert = require('node:assert/strict')
const { after, test } = require('node:test')
const {
    getNpmSpawnConfig,
    getTerminationTarget,
    shouldUseProcessGroup,
} = require('./processTree.cjs')

const repoRoot = path.resolve(__dirname, '..')
const processes = []
let tempDir = null

function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer()
        server.unref()
        server.on('error', reject)
        server.listen(0, '127.0.0.1', () => {
            const address = server.address()
            server.close(() => resolve(address.port))
        })
    })
}

function startProcess(name, args, cwd, env = {}) {
    const config = getNpmSpawnConfig(args)
    const child = spawn(config.command, config.args, {
        cwd,
        detached: config.detached,
        env: {
            ...process.env,
            ...env,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    })

    let output = ''
    child.stdout.on('data', (chunk) => {
        output += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
        output += chunk.toString()
    })

    processes.push({ name, child, get output() { return output } })
    return child
}

async function stopProcess(entry) {
    const destroyPipes = () => {
        entry.child.stdout?.destroy()
        entry.child.stderr?.destroy()
    }

    const signalProcess = (signal) => {
        if (process.platform === 'win32') {
            if (signal === 'SIGTERM' && entry.child.pid) {
                spawn('taskkill', ['/pid', String(entry.child.pid), '/T', '/F'], { stdio: 'ignore' })
            }
            return
        }

        if (!entry.child.pid) return

        try {
            process.kill(getTerminationTarget(entry.child.pid), signal)
        } catch (error) {
            if (error.code !== 'ESRCH') {
                throw error
            }
        }
    }

    await new Promise((resolve) => {
        let settled = false
        const finish = () => {
            if (settled) return
            settled = true
            destroyPipes()
            resolve()
        }

        if (entry.child.exitCode !== null || entry.child.signalCode) {
            if (shouldUseProcessGroup()) {
                signalProcess('SIGTERM')
            }
            setTimeout(finish, 250).unref()
            return
        }

        entry.child.once('exit', finish)
        signalProcess('SIGTERM')

        setTimeout(() => {
            if (entry.child.exitCode === null) {
                signalProcess('SIGKILL')
            }
        }, 3000).unref()

        setTimeout(finish, 5000).unref()
    })
}

async function waitFor(label, check) {
    const deadline = Date.now() + 30000
    let lastError = null

    while (Date.now() < deadline) {
        try {
            await check()
            return
        } catch (error) {
            lastError = error
            await delay(250)
        }
    }

    const logs = processes
        .map((entry) => `\n[${entry.name}]\n${entry.output.slice(-4000)}`)
        .join('\n')
    throw new Error(`Timed out waiting for ${label}: ${lastError?.message || lastError}${logs}`)
}

after(async () => {
    await Promise.all(processes.map(stopProcess))
    if (tempDir) {
        await rm(tempDir, { recursive: true, force: true })
    }
})

test('Railway production start command serves API and built client', async () => {
    const clientDist = path.join(repoRoot, 'client', 'dist')
    assert.equal(
        existsSync(path.join(clientDist, 'index.html')),
        true,
        'client/dist/index.html must exist; run npm run build:client before this smoke test'
    )

    tempDir = await mkdtemp(path.join(os.tmpdir(), 'gingerbread-railway-smoke-'))
    const port = await getFreePort()
    const appUrl = `http://127.0.0.1:${port}`

    startProcess('railway-start', ['start'], repoRoot, {
        NODE_ENV: 'production',
        PORT: String(port),
        RAILWAY_PUBLIC_DOMAIN: `localhost:${port}`,
        ROOM_SNAPSHOT_FILE: path.join(tempDir, 'room-snapshots.json'),
    })

    await waitFor('production health endpoint', async () => {
        const response = await fetch(`${appUrl}/health`)
        assert.equal(response.status, 200)
    })

    const health = await (await fetch(`${appUrl}/health`)).json()
    assert.equal(health.status, 'ok')

    const roomResponse = await fetch(`${appUrl}/api/room`, { method: 'POST' })
    assert.equal(roomResponse.status, 200)
    const room = await roomResponse.json()
    assert.match(room.roomId, /^[A-HJ-NP-Z2-9]{6}$/)

    const rootResponse = await fetch(appUrl)
    assert.equal(rootResponse.status, 200)
    const rootHtml = await rootResponse.text()
    assert.match(rootHtml, /<div id="root"><\/div>/)
    assert.match(rootHtml, /Gingerbread Collab Builder/)

    const roomRouteResponse = await fetch(`${appUrl}/room/${room.roomId}`)
    assert.equal(roomRouteResponse.status, 200)
    const roomRouteHtml = await roomRouteResponse.text()
    assert.match(roomRouteHtml, /<div id="root"><\/div>/)
})
