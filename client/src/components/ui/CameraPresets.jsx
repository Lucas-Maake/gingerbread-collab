import { useState } from 'react'
import './CameraPresets.css'

// Camera preset definitions
// azimuth: horizontal angle (0 = front, π/2 = right, π = back, -π/2 = left)
// polar: vertical angle (0 = top, π/2 = side)
const PRESETS = [
  {
    id: 'front',
    label: 'Front',
    icon: '▲',
    azimuth: 0,
    polar: Math.PI / 4,
    zoom: 50
  },
  {
    id: 'back',
    label: 'Back',
    icon: '▼',
    azimuth: Math.PI,
    polar: Math.PI / 4,
    zoom: 50
  },
  {
    id: 'left',
    label: 'Left',
    icon: '◀',
    azimuth: -Math.PI / 2,
    polar: Math.PI / 4,
    zoom: 50
  },
  {
    id: 'right',
    label: 'Right',
    icon: '▶',
    azimuth: Math.PI / 2,
    polar: Math.PI / 4,
    zoom: 50
  },
  {
    id: 'top',
    label: 'Top',
    icon: '◉',
    azimuth: 0,
    polar: 0.15,
    zoom: 45
  },
  {
    id: 'isometric',
    label: 'Iso',
    icon: '◇',
    azimuth: Math.PI / 4,
    polar: Math.PI / 4,
    zoom: 50
  }
]

/**
 * Camera presets panel for quick view switching
 */
export default function CameraPresets() {
  const [activePreset, setActivePreset] = useState('isometric')
  const [isExpanded, setIsExpanded] = useState(false)

  const handlePresetClick = (preset) => {
    setActivePreset(preset.id)

    // Dispatch custom event to CameraController
    window.dispatchEvent(new CustomEvent('setCameraPreset', {
      detail: {
        azimuth: preset.azimuth,
        polar: preset.polar,
        zoom: preset.zoom
      }
    }))
  }

  return (
    <div className={`camera-presets ${isExpanded ? 'expanded' : ''}`}>
      <button
        className="camera-presets-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? 'Collapse camera presets' : 'Expand camera presets'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        <span className="toggle-label">Views</span>
      </button>

      {isExpanded && (
        <div className="camera-presets-panel">
          <div className="presets-grid">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={`preset-btn ${activePreset === preset.id ? 'active' : ''}`}
                onClick={() => handlePresetClick(preset)}
                title={`${preset.label} view`}
              >
                <span className="preset-icon">{preset.icon}</span>
                <span className="preset-label">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
