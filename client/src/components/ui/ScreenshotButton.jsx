import { useState, useCallback } from 'react'
import { playGlobalSound, SoundType } from '../../hooks/useSoundEffects'
import './ScreenshotButton.css'

/**
 * Screenshot button to capture and download the 3D scene
 */
export default function ScreenshotButton() {
  const [isCapturing, setIsCapturing] = useState(false)

  const handleScreenshot = useCallback(async () => {
    if (isCapturing) return

    setIsCapturing(true)

    try {
      // Find the Three.js canvas
      const canvas = document.querySelector('.canvas-container canvas')

      if (!canvas) {
        console.error('Canvas not found')
        setIsCapturing(false)
        return
      }

      // Get the WebGL context and render one more frame to ensure latest state
      // Then capture the image
      const dataUrl = canvas.toDataURL('image/png')

      // Create download link
      const link = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      link.download = `gingerbread-house-${timestamp}.png`
      link.href = dataUrl

      // Trigger download
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Play a satisfying sound
      playGlobalSound(SoundType.SPAWN)

    } catch (error) {
      console.error('Screenshot failed:', error)
    } finally {
      setIsCapturing(false)
    }
  }, [isCapturing])

  return (
    <button
      className={`screenshot-button ${isCapturing ? 'capturing' : ''}`}
      onClick={handleScreenshot}
      disabled={isCapturing}
      title="Take a screenshot of your creation"
      aria-label="Take screenshot"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M12 17.5c2.33 0 4.3-1.46 5.11-3.5H6.89c.81 2.04 2.78 3.5 5.11 3.5z" opacity="0.3"/>
        <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
      <span className="screenshot-label">
        {isCapturing ? 'Saving...' : 'Screenshot'}
      </span>
    </button>
  )
}
