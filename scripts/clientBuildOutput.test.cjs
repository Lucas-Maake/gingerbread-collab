const { readFile, readdir } = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const test = require('node:test')

const repoRoot = path.resolve(__dirname, '..')
const clientDist = path.join(repoRoot, 'client', 'dist')

async function getEntryBundle() {
    const html = await readFile(path.join(clientDist, 'index.html'), 'utf8')
    const match = html.match(/<script type="module" crossorigin src="\/assets\/([^"]+)"/)
    assert.ok(match, 'index.html must include a module entry script')

    const js = await readFile(path.join(clientDist, 'assets', match[1]), 'utf8')
    return { html, js }
}

test('landing entry does not eagerly load room-only chunks', async () => {
    const { html, js } = await getEntryBundle()
    const assets = await readdir(path.join(clientDist, 'assets'))
    const roomOnlyChunks = assets.filter((asset) => (
        asset.startsWith('RoomPage-') ||
        asset.startsWith('vendor-drei-') ||
        asset.startsWith('vendor-r3f-') ||
        asset.startsWith('vendor-three-')
    ))

    assert.ok(roomOnlyChunks.length > 0, 'expected room-only chunks to exist')
    assert.equal(
        html.includes('rel="modulepreload"'),
        false,
        'index.html should not modulepreload room-only chunks before the room route is opened'
    )

    for (const asset of roomOnlyChunks) {
        assert.equal(
            html.includes(`/assets/${asset}`),
            false,
            `index.html should not reference room-only chunk ${asset}`
        )
        assert.equal(
            js.includes(`import"./${asset}"`) || js.includes(`import './${asset}'`),
            false,
            `entry bundle should not statically import room-only chunk ${asset}`
        )
    }
})
