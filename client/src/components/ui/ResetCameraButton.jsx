import { useCallback } from 'react'
import './ResetCameraButton.css'

/**
 * Button to reset camera to default isometric view
 */
export default function ResetCameraButton() {
  const handleReset = useCallback(() => {
    // Dispatch custom event that CameraController listens for
    window.dispatchEvent(new CustomEvent('resetCamera'))
  }, [])

  return (
    <button
      className="reset-camera-button"
      onClick={handleReset}
      title="Reset camera to default view"
      aria-label="Reset camera"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
      </svg>
      <span className="reset-camera-label">Reset View</span>
    </button>
  )
}
