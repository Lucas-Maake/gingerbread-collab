import { useMemo, useState } from 'react'
import { useGameStore } from '../../context/gameStore'
import './BuildHistoryPanel.css'

function formatHistoryTime(timestamp: number) {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
    })
}

export default function BuildHistoryPanel() {
    const [isOpen, setIsOpen] = useState(false)
    const historyEntries = useGameStore((state) => state.historyEntries)
    const undoCount = useGameStore((state) => state.undoCount)
    const undo = useGameStore((state) => state.undo)

    const recentEntries = useMemo(() => {
        return [...historyEntries].reverse()
    }, [historyEntries])

    return (
        <div className={`build-history ${isOpen ? 'open' : ''}`}>
            <button
                className="build-history-toggle"
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-controls="build-history-panel"
            >
                History
                {historyEntries.length > 0 && (
                    <span className="build-history-count">{historyEntries.length}</span>
                )}
            </button>

            {isOpen && (
                <section
                    id="build-history-panel"
                    className="build-history-panel"
                    aria-label="Build history"
                >
                    <div className="build-history-header">
                        <h3>Build History</h3>
                        <button
                            className="build-history-undo"
                            type="button"
                            onClick={() => void undo()}
                            disabled={undoCount === 0}
                            aria-label="Undo last action"
                        >
                            Undo
                            {undoCount > 0 && <span>({undoCount})</span>}
                        </button>
                    </div>

                    {recentEntries.length > 0 ? (
                        <ol className="build-history-list">
                            {recentEntries.map((entry) => (
                                <li key={entry.id} className="build-history-item">
                                    <span
                                        className="build-history-user-dot"
                                        style={{ backgroundColor: entry.userColor || '#94a3b8' }}
                                        aria-hidden="true"
                                    />
                                    <span className="build-history-copy">
                                        <strong>{entry.userName}</strong>
                                        <span>{entry.description}</span>
                                    </span>
                                    <time dateTime={new Date(entry.createdAt).toISOString()}>
                                        {formatHistoryTime(entry.createdAt)}
                                    </time>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="build-history-empty">No build activity yet.</p>
                    )}
                </section>
            )}
        </div>
    )
}
