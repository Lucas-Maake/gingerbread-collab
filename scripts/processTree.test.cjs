const assert = require('node:assert/strict')
const test = require('node:test')

const {
    getNpmSpawnConfig,
    getTerminationTarget,
    shouldUseProcessGroup,
} = require('./processTree.cjs')

test('uses process groups for Unix npm child processes', () => {
    assert.equal(shouldUseProcessGroup('linux'), true)
    assert.equal(getTerminationTarget(1234, 'linux'), -1234)

    const config = getNpmSpawnConfig(['run', 'dev'], 'linux')
    assert.equal(config.command, 'npm')
    assert.deepEqual(config.args, ['run', 'dev'])
    assert.equal(config.detached, true)
})

test('uses cmd without process groups on Windows', () => {
    assert.equal(shouldUseProcessGroup('win32'), false)
    assert.equal(getTerminationTarget(1234, 'win32'), 1234)

    const config = getNpmSpawnConfig(['start'], 'win32', { ComSpec: 'cmd.exe' })
    assert.equal(config.command, 'cmd.exe')
    assert.deepEqual(config.args, ['/d', '/s', '/c', 'npm start'])
    assert.equal(config.detached, false)
})
