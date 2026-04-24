function shouldUseProcessGroup(platform = process.platform) {
    return platform !== 'win32'
}

function getNpmSpawnConfig(args, platform = process.platform, env = process.env) {
    if (platform === 'win32') {
        return {
            command: env.ComSpec || 'cmd.exe',
            args: ['/d', '/s', '/c', ['npm', ...args].join(' ')],
            detached: false,
        }
    }

    return {
        command: 'npm',
        args,
        detached: true,
    }
}

function getTerminationTarget(pid, platform = process.platform) {
    return shouldUseProcessGroup(platform) ? -pid : pid
}

module.exports = {
    getNpmSpawnConfig,
    getTerminationTarget,
    shouldUseProcessGroup,
}
