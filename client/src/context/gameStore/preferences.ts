export function getInitialTableSnowEnabled() {
    if (typeof window === 'undefined') return false
    const saved = localStorage.getItem('tableSnowEnabled')
    return saved === 'true'
}

export function getPreferredUserName(fallbackName: string | null = null) {
    if (typeof window === 'undefined') {
        return fallbackName || 'Guest'
    }

    const saved = localStorage.getItem('nickname')
    const trimmed = saved?.trim()
    if (trimmed) return trimmed

    return fallbackName || 'Guest'
}
