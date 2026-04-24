const { spawn } = require('node:child_process')
const { createRequire } = require('node:module')
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
const clientRequire = createRequire(path.join(repoRoot, 'client', 'package.json'))
const { chromium } = clientRequire('playwright')

const processes = []
const tempDirs = []

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

async function getBrowserDiagnostics(page, pageErrors, failedRequests) {
    const rootText = await page.locator('#root').innerText({ timeout: 1000 }).catch((error) => {
        return `<unavailable: ${error.message}>`
    })
    const rootHtml = await page.locator('#root').evaluate((element) => element.innerHTML.slice(0, 1000), { timeout: 1000 }).catch((error) => {
        return `<unavailable: ${error.message}>`
    })
    const serverLogs = processes
        .map((entry) => `\n[${entry.name}]\n${entry.output.slice(-4000)}`)
        .join('\n')

    return [
        `URL: ${page.url()}`,
        `#root text:\n${rootText}`,
        `#root html:\n${rootHtml}`,
        `Page errors:\n${pageErrors.join('\n') || '<none>'}`,
        `Failed requests:\n${failedRequests.join('\n') || '<none>'}`,
        `Server logs:${serverLogs || '\n<none>'}`,
    ].join('\n\n')
}

function isExpectedFailedRequest(request) {
    const failureText = request.failure()?.errorText || ''
    const requestUrl = request.url()

    return failureText === 'net::ERR_ABORTED' && /\/music\/[^/]+\.mp3$/.test(requestUrl)
}

async function waitForVisible(locator, label, page, pageErrors, failedRequests) {
    try {
        await locator.waitFor()
    } catch (error) {
        const diagnostics = await getBrowserDiagnostics(page, pageErrors, failedRequests)
        throw new Error(`Timed out waiting for ${label}: ${error.message}\n\n${diagnostics}`)
    }
}

after(async () => {
    await Promise.all(processes.map(stopProcess))
    await Promise.all(tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })))
})

test('production build renders the landing UI in a real browser', async () => {
    assert.equal(
        existsSync(path.join(repoRoot, 'client', 'dist', 'index.html')),
        true,
        'client/dist/index.html must exist; run npm run build:client before this browser smoke test'
    )

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gingerbread-browser-smoke-'))
    tempDirs.push(tempDir)
    const port = await getFreePort()
    const appUrl = `http://127.0.0.1:${port}`

    startProcess('production-browser-start', ['start'], repoRoot, {
        NODE_ENV: 'production',
        PORT: String(port),
        CLIENT_URL: appUrl,
        RAILWAY_PUBLIC_DOMAIN: `localhost:${port}`,
        ROOM_SNAPSHOT_FILE: path.join(tempDir, 'room-snapshots.json'),
    })

    await waitFor('production health endpoint', async () => {
        const response = await fetch(`${appUrl}/health`)
        assert.equal(response.status, 200)
    })

    const browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const pageErrors = []
    const failedRequests = []

    page.on('pageerror', (error) => {
        pageErrors.push(error.stack || error.message)
    })
    page.on('requestfailed', (request) => {
        if (isExpectedFailedRequest(request)) {
            return
        }
        failedRequests.push(`${request.url()} ${request.failure()?.errorText || ''}`.trim())
    })

    try {
        const response = await page.goto(appUrl, { waitUntil: 'networkidle' })
        assert.equal(response?.status(), 200)
        await waitForVisible(page.getByRole('heading', { name: 'Gingerbread Collab' }), 'landing heading', page, pageErrors, failedRequests)
        await waitForVisible(page.getByRole('button', { name: 'Create New Room' }), 'create room button', page, pageErrors, failedRequests)
        assert.deepEqual(pageErrors, [])
        assert.deepEqual(failedRequests, [])
    } finally {
        await browser.close()
    }
})

test('production build can create a room and spawn a piece in a real browser', async () => {
    assert.equal(
        existsSync(path.join(repoRoot, 'client', 'dist', 'index.html')),
        true,
        'client/dist/index.html must exist; run npm run build:client before this browser smoke test'
    )

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gingerbread-browser-smoke-'))
    tempDirs.push(tempDir)
    const port = await getFreePort()
    const appUrl = `http://127.0.0.1:${port}`

    startProcess('production-browser-room-start', ['start'], repoRoot, {
        NODE_ENV: 'production',
        PORT: String(port),
        CLIENT_URL: appUrl,
        RAILWAY_PUBLIC_DOMAIN: `localhost:${port}`,
        ROOM_SNAPSHOT_FILE: path.join(tempDir, 'room-snapshots.json'),
    })

    await waitFor('production health endpoint', async () => {
        const response = await fetch(`${appUrl}/health`)
        assert.equal(response.status, 200)
    })

    const browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const pageErrors = []
    const failedRequests = []

    page.on('pageerror', (error) => {
        pageErrors.push(error.stack || error.message)
    })
    page.on('requestfailed', (request) => {
        if (isExpectedFailedRequest(request)) {
            return
        }
        failedRequests.push(`${request.url()} ${request.failure()?.errorText || ''}`.trim())
    })

    try {
        const response = await page.goto(appUrl, { waitUntil: 'networkidle' })
        assert.equal(response?.status(), 200)

        await page.getByLabel('Nickname (optional)').fill('Smoke')
        await page.getByRole('button', { name: 'Create New Room' }).click()

        await page.waitForURL(/\/room\/[A-Z0-9]{6}$/)
        const roomId = page.url().match(/\/room\/([A-Z0-9]{6})$/)?.[1]
        assert.match(roomId || '', /^[A-Z0-9]{6}$/)

        await waitForVisible(page.getByRole('heading', { name: `Room: ${roomId}` }), 'room heading', page, pageErrors, failedRequests)
        await waitForVisible(page.getByRole('button', { name: /Copy Link/ }), 'copy link button', page, pageErrors, failedRequests)
        await waitForVisible(page.getByText(/^0\/\d+ pieces$/), 'initial piece count', page, pageErrors, failedRequests)

        await page.getByRole('button', { name: /Gumdrop/ }).click()
        await waitForVisible(page.getByText(/^1\/\d+ pieces$/), 'updated piece count after spawning a piece', page, pageErrors, failedRequests)

        assert.deepEqual(pageErrors, [])
        assert.deepEqual(failedRequests, [])
    } finally {
        await browser.close()
    }
})
