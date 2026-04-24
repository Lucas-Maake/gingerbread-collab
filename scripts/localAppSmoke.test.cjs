const { spawn } = require('node:child_process')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')
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
        env: {
            ...process.env,
            ...env
        },
        detached: config.detached,
        stdio: ['ignore', 'pipe', 'pipe']
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

test('local client and server boot and expose the app shell', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'gingerbread-smoke-'))
    const serverPort = await getFreePort()
    const clientPort = await getFreePort()
    const serverUrl = `http://127.0.0.1:${serverPort}`
    const clientUrl = `http://127.0.0.1:${clientPort}`

    startProcess('server', ['start'], path.join(repoRoot, 'server'), {
        NODE_ENV: 'test',
        PORT: String(serverPort),
        ROOM_SNAPSHOT_FILE: path.join(tempDir, 'room-snapshots.json')
    })

    await waitFor('server health endpoint', async () => {
        const response = await fetch(`${serverUrl}/health`)
        assert.equal(response.status, 200)
    })

    startProcess('client', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(clientPort), '--strictPort'], path.join(repoRoot, 'client'), {
        VITE_SERVER_URL: serverUrl
    })

    await waitFor('client dev server', async () => {
        const response = await fetch(clientUrl)
        assert.equal(response.status, 200)
    })

    const health = await (await fetch(`${serverUrl}/health`)).json()
    assert.equal(health.status, 'ok')

    const room = await (await fetch(`${serverUrl}/api/room`, { method: 'POST' })).json()
    assert.match(room.roomId, /^[A-HJ-NP-Z2-9]{6}$/)

    const html = await (await fetch(clientUrl)).text()
    assert.match(html, /<div id="root"><\/div>/)
    assert.match(html, /Gingerbread Collab Builder/)
})
