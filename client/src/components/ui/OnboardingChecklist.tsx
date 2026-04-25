import { useMemo, useState } from 'react'
import { useGameStore } from '../../context/gameStore'
import type { PieceType } from '../../types'
import './OnboardingChecklist.css'

const DECORATION_TYPES = new Set<PieceType>([
    'CANDY_CANE',
    'GUMDROP',
    'PEPPERMINT',
    'GINGERBREAD_MAN',
    'COOKIE_STAR',
    'COOKIE_HEART',
    'MINI_TREE',
    'SNOWFLAKE',
    'CANDY_BUTTON',
    'LICORICE',
    'FROSTING_DOLLOP',
    'CHIMNEY',
    'FENCE_POST',
    'PRESENT',
])

interface OnboardingChecklistProps {
    hasUsedPhotoMode: boolean
}

export default function OnboardingChecklist({ hasUsedPhotoMode }: OnboardingChecklistProps) {
    const [isDismissed, setIsDismissed] = useState(false)
    const users = useGameStore((state) => state.users)
    const pieces = useGameStore((state) => state.pieces)
    const walls = useGameStore((state) => state.walls)

    const steps = useMemo(() => {
        const placedPieces = Array.from(pieces.values())
        const hasRoof = placedPieces.some((piece) => piece.type === 'ROOF_LEFT' || piece.type === 'ROOF_RIGHT')
        const hasDecoration = placedPieces.some((piece) => DECORATION_TYPES.has(piece.type))

        return [
            {
                label: 'Start with a template or draw a wall',
                complete: walls.size > 0,
            },
            {
                label: 'Add roof pieces',
                complete: hasRoof,
            },
            {
                label: 'Place a decoration',
                complete: hasDecoration,
            },
            {
                label: 'Invite a friend',
                complete: users.size > 1,
            },
            {
                label: 'Try photo mode',
                complete: hasUsedPhotoMode,
            },
        ]
    }, [hasUsedPhotoMode, pieces, users, walls])

    if (isDismissed) return null

    const completedCount = steps.filter((step) => step.complete).length
    const progressLabel = `${completedCount} of ${steps.length} complete`
    const summary = completedCount === steps.length
        ? 'Ready for a snapshot'
        : 'Finish the basics to get the room ready'

    return (
        <section className="onboarding-checklist" aria-label="Getting started">
            <div className="onboarding-header">
                <div>
                    <h3>Getting Started</h3>
                    <p>{summary}</p>
                </div>
                <button
                    type="button"
                    className="onboarding-dismiss"
                    onClick={() => setIsDismissed(true)}
                    aria-label="Hide getting started guide"
                    title="Hide guide"
                >
                    Hide
                </button>
            </div>

            <div className="onboarding-progress" aria-live="polite">
                <span>{progressLabel}</span>
                <div className="onboarding-progress-track" aria-hidden="true">
                    <span style={{ width: `${(completedCount / steps.length) * 100}%` }} />
                </div>
            </div>

            <ol className="onboarding-steps">
                {steps.map((step) => (
                    <li
                        key={step.label}
                        className={step.complete ? 'complete' : ''}
                        aria-label={`${step.complete ? 'Completed' : 'Not completed'}: ${step.label}`}
                    >
                        <span className="onboarding-status-dot" aria-hidden="true" />
                        <span>{step.label}</span>
                    </li>
                ))}
            </ol>
        </section>
    )
}
