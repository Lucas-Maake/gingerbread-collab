const { spawnSync } = require('node:child_process')
const path = require('node:path')

const playwrightCli = path.resolve(__dirname, '..', 'client', 'node_modules', 'playwright', 'cli.js')
const result = spawnSync(process.execPath, [playwrightCli, 'install', 'chromium'], {
    stdio: 'inherit',
})

if (result.error) {
    throw result.error
}

process.exit(result.status ?? 1)
