import { useState } from 'react'
import { setGlobalSfxMuted, isGlobalSfxMuted } from '../../hooks/useSoundEffects'
import './SfxMuteButton.css'

/**
 * Mute button for sound effects control
 */
export default function SfxMuteButton() {
    const [isMuted, setIsMuted] = useState(isGlobalSfxMuted())

    const handleToggle = () => {
        const newMuted = !isMuted
        setIsMuted(newMuted)
        setGlobalSfxMuted(newMuted)
    }

    return (
        <button
            className={`sfx-mute-button ${isMuted ? 'muted' : ''}`}
            onClick={handleToggle}
            title={isMuted ? 'Unmute sound effects' : 'Mute sound effects'}
            aria-label={isMuted ? 'Unmute sound effects' : 'Mute sound effects'}
        >
            {isMuted ? (
                // Muted icon (bell with slash)
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" opacity="0.3" />
                    <path d="M4.34 2.93L2.93 4.34 7.29 8.7c-.18.7-.29 1.43-.29 2.3v5l-2 2v1h13.17l2.07 2.07 1.41-1.41L4.34 2.93zM12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-7.97V11c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68c-.24.06-.47.15-.69.23L18 13.03z" />
                </svg>
            ) : (
                // Unmuted icon (bell)
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                </svg>
            )}
            <span className="sfx-label">SFX</span>
        </button>
    )
}
