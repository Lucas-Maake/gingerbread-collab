import { useCallback, useMemo, useRef, useState } from 'react'
import { useGameStore } from '../../context/gameStore'
import './SnapshotShareCard.css'

async function copyText(text: string): Promise<boolean> {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text)
            return true
        } catch {
            // Use the textarea fallback below.
        }
    }

    try {
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.setAttribute('readonly', '')
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        textArea.style.pointerEvents = 'none'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()

        const copied = document.execCommand('copy')
        document.body.removeChild(textArea)
        return copied
    } catch {
        return false
    }
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`
}

interface SnapshotShareCardProps {
    roomId: string
}

export default function SnapshotShareCard({ roomId }: SnapshotShareCardProps) {
    const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle')
    const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pieceCount = useGameStore((state) => state.pieceCount)
    const wallCount = useGameStore((state) => state.walls.size)
    const builderCount = useGameStore((state) => state.users.size)

    const shareText = useMemo(() => {
        return [
            `Come see my gingerbread build in room ${roomId}.`,
            `${pluralize(pieceCount, 'piece')}, ${pluralize(wallCount, 'wall')}, ${pluralize(builderCount, 'builder')}.`,
            window.location.href,
        ].join(' ')
    }, [builderCount, pieceCount, roomId, wallCount])

    const handleCopy = useCallback(async () => {
        if (resetTimeoutRef.current) {
            clearTimeout(resetTimeoutRef.current)
        }

        const copied = await copyText(shareText)
        setCopyState(copied ? 'success' : 'error')
        resetTimeoutRef.current = setTimeout(() => {
            setCopyState('idle')
            resetTimeoutRef.current = null
        }, 2000)
    }, [shareText])

    const copyLabel = copyState === 'success'
        ? 'Snapshot Copied'
        : copyState === 'error'
            ? 'Copy Failed'
            : 'Copy Share Text'

    return (
        <section className="snapshot-share-card" aria-label="Share snapshot">
            <span className="snapshot-share-kicker">Ready to share</span>
            <h3>Room {roomId}</h3>
            <div className="snapshot-share-stats" aria-label="Build stats">
                <span>{pluralize(pieceCount, 'piece')}</span>
                <span>{pluralize(wallCount, 'wall')}</span>
                <span>{pluralize(builderCount, 'builder')}</span>
            </div>
            <button
                type="button"
                className={`snapshot-share-button ${copyState === 'success' ? 'copied' : ''} ${copyState === 'error' ? 'copy-error' : ''}`}
                onClick={handleCopy}
                aria-live="polite"
            >
                {copyLabel}
            </button>
        </section>
    )
}
