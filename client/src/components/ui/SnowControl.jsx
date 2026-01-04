import { useState, useEffect, useCallback } from 'react'
import './SnowControl.css'

// Snow intensity levels
export const SNOW_LEVELS = {
  OFF: { label: 'Off', count: 0 },
  LIGHT: { label: 'Light', count: 100 },
  MEDIUM: { label: 'Medium', count: 250 },
  HEAVY: { label: 'Heavy', count: 500 }
}

const LEVEL_ORDER = ['OFF', 'LIGHT', 'MEDIUM', 'HEAVY']

/**
 * Snow intensity control button
 */
export default function SnowControl() {
  const [level, setLevel] = useState(() => {
    const saved = localStorage.getItem('snowLevel')
    return saved && SNOW_LEVELS[saved] ? saved : 'MEDIUM'
  })

  // Notify SnowParticles of intensity changes
  useEffect(() => {
    localStorage.setItem('snowLevel', level)
    window.dispatchEvent(new CustomEvent('snowIntensityChange', {
      detail: { level, count: SNOW_LEVELS[level].count }
    }))
  }, [level])

  const cycleLevel = useCallback(() => {
    setLevel(current => {
      const currentIndex = LEVEL_ORDER.indexOf(current)
      const nextIndex = (currentIndex + 1) % LEVEL_ORDER.length
      return LEVEL_ORDER[nextIndex]
    })
  }, [])

  const decreaseLevel = useCallback((e) => {
    e.stopPropagation()
    setLevel(current => {
      const currentIndex = LEVEL_ORDER.indexOf(current)
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0
      return LEVEL_ORDER[prevIndex]
    })
  }, [])

  const increaseLevel = useCallback((e) => {
    e.stopPropagation()
    setLevel(current => {
      const currentIndex = LEVEL_ORDER.indexOf(current)
      const nextIndex = currentIndex < LEVEL_ORDER.length - 1 ? currentIndex + 1 : currentIndex
      return LEVEL_ORDER[nextIndex]
    })
  }, [])

  const currentLevel = SNOW_LEVELS[level]
  const isOff = level === 'OFF'
  const isMax = level === 'HEAVY'
  const isMin = level === 'OFF'

  return (
    <div className="snow-control">
      <button
        className="snow-control-decrease"
        onClick={decreaseLevel}
        disabled={isMin}
        title="Decrease snow"
        aria-label="Decrease snow intensity"
      >
        -
      </button>
      <button
        className={`snow-control-main ${isOff ? 'off' : ''}`}
        onClick={cycleLevel}
        title={`Snow: ${currentLevel.label} (click to cycle)`}
        aria-label={`Snow intensity: ${currentLevel.label}`}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
          <path d="M22 11h-4.17l2.54-2.54-1.42-1.42L15 11h-2V9l3.96-3.96-1.42-1.42L13 6.17V2h-2v4.17L8.46 3.63 7.04 5.04 11 9v2H9L5.04 7.04 3.63 8.46 6.17 11H2v2h4.17l-2.54 2.54 1.42 1.42L9 13h2v2l-3.96 3.96 1.42 1.42L11 17.83V22h2v-4.17l2.54 2.54 1.42-1.42L13 15v-2h2l3.96 3.96 1.42-1.42L17.83 13H22v-2z"/>
        </svg>
        <span className="snow-label">{currentLevel.label}</span>
      </button>
      <button
        className="snow-control-increase"
        onClick={increaseLevel}
        disabled={isMax}
        title="Increase snow"
        aria-label="Increase snow intensity"
      >
        +
      </button>
    </div>
  )
}
