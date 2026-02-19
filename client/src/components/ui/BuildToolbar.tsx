import { useGameStore } from '../../context/gameStore'
import './BuildToolbar.css'

export default function BuildToolbar() {
    const buildMode = useGameStore((state) => state.buildMode)
    const setBuildMode = useGameStore((state) => state.setBuildMode)
    const gridSnapEnabled = useGameStore((state) => state.gridSnapEnabled)
    const toggleGridSnap = useGameStore((state) => state.toggleGridSnap)
    const roofStyle = useGameStore((state) => state.roofStyle)
    const toggleRoofStyle = useGameStore((state) => state.toggleRoofStyle)
    const roofPitchAngle = useGameStore((state) => state.roofPitchAngle)
    const setRoofPitchAngle = useGameStore((state) => state.setRoofPitchAngle)
    const tableSnowEnabled = useGameStore((state) => state.tableSnowEnabled)
    const toggleTableSnow = useGameStore((state) => state.toggleTableSnow)

    return (
        <div className="build-toolbar">
            <div className="toolbar-section">
                <span className="toolbar-label">Mode</span>
                <div className="toolbar-buttons">
                    <button
                        className={`toolbar-btn ${buildMode === 'select' ? 'active' : ''}`}
                        onClick={() => setBuildMode('select')}
                        title="Select & Move (V)"
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <path d="M7 2l12 11.2-5.8.5 3.3 7.3-2.2 1-3.2-7.4L7 18.5V2z" />
                        </svg>
                        <span>Select</span>
                    </button>
                    <button
                        className={`toolbar-btn ${buildMode === 'wall' ? 'active' : ''}`}
                        onClick={() => setBuildMode('wall')}
                        title="Draw Walls (W)"
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <path d="M3 5v14h18V5H3zm16 12H5V7h14v10zM7 9h2v2H7V9zm4 0h2v2h-2V9zm4 0h2v2h-2V9zm-8 4h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z" />
                        </svg>
                        <span>Wall</span>
                    </button>
                    <button
                        className={`toolbar-btn ${buildMode === 'fence' ? 'active' : ''}`}
                        onClick={() => setBuildMode('fence')}
                        title="Draw Fences (F)"
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <path d="M4 4h2v16H4V4zm7 0h2v16h-2V4zm7 0h2v16h-2V4zM2 9h20v2H2V9zm0 5h20v2H2v-2z" />
                        </svg>
                        <span>Fence</span>
                    </button>
                    <button
                        className={`toolbar-btn ${buildMode === 'icing' ? 'active' : ''}`}
                        onClick={() => setBuildMode('icing')}
                        title="Draw Icing (I)"
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <path d="M18.5 2h-13L2 9.5V22h20V9.5L18.5 2zM12 18c-1.1 0-2-.9-2-2 0-.8.5-2 2-4 1.5 2 2 3.2 2 4 0 1.1-.9 2-2 2zm6-9H6l2.5-5h7l2.5 5z" />
                        </svg>
                        <span>Icing</span>
                    </button>
                </div>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-section">
                <span className="toolbar-label">Options</span>
                <button
                    className={`toolbar-btn toggle ${gridSnapEnabled ? 'active' : ''}`}
                    onClick={toggleGridSnap}
                    title="Toggle Grid Snap (G)"
                >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M20 3H4c-.55 0-1 .45-1 1v16c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zM8 19H5v-3h3v3zm0-5H5v-3h3v3zm0-5H5V6h3v3zm5 10h-3v-3h3v3zm0-5h-3v-3h3v3zm0-5h-3V6h3v3zm5 10h-3v-3h3v3zm0-5h-3v-3h3v3zm0-5h-3V6h3v3z" />
                    </svg>
                    <span>Grid</span>
                </button>
                <button
                    className={`toolbar-btn toggle ${roofStyle === 'pitched' ? 'active' : ''}`}
                    onClick={toggleRoofStyle}
                    title="Toggle Roof Style (R)"
                >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        {roofStyle === 'pitched' ? (
                            <path d="M12 3L2 12h3v8h14v-8h3L12 3zm0 2.8L18.5 12H17v6H7v-6H5.5L12 5.8z" />
                        ) : (
                            <path d="M3 13h18v-2H3v2zm0 6h18v-6H3v6z" />
                        )}
                    </svg>
                    <span>{roofStyle === 'pitched' ? 'Pitched' : 'Flat'}</span>
                </button>
                <button
                    className={`toolbar-btn toggle ${tableSnowEnabled ? 'active' : ''}`}
                    onClick={toggleTableSnow}
                    title="Toggle snowy tabletop"
                >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M22 11h-4.17l2.54-2.54-1.42-1.42L15 11h-2V9l3.96-3.96-1.42-1.42L13 6.17V2h-2v4.17L8.46 3.63 7.04 5.04 11 9v2H9L5.04 7.04 3.63 8.46 6.17 11H2v2h4.17l-2.54 2.54 1.42 1.42L9 13h2v2l-3.96 3.96 1.42 1.42L11 17.83V22h2v-4.17l2.54 2.54 1.42-1.42L13 15v-2h2l3.96 3.96 1.42-1.42L17.83 13H22v-2z" />
                    </svg>
                    <span>Snowy</span>
                </button>
            </div>

            {roofStyle === 'pitched' && (
                <>
                    <div className="toolbar-divider" />
                    <div className="toolbar-section slider-section">
                        <span className="toolbar-label">Roof Angle: {roofPitchAngle}°</span>
                        <input
                            type="range"
                            className="roof-angle-slider"
                            min="15"
                            max="75"
                            value={roofPitchAngle}
                            onChange={(e) => setRoofPitchAngle(Number(e.target.value))}
                            title="Adjust roof pitch angle"
                        />
                    </div>
                </>
            )}

            {buildMode === 'wall' && (
                <div className="toolbar-hint">
                    Click to set start point, click again to place wall
                </div>
            )}

            {buildMode === 'fence' && (
                <div className="toolbar-hint">
                    Click to set start point, click again to place a fence row
                </div>
            )}

            {buildMode === 'icing' && (
                <div className="toolbar-hint">
                    Click and drag on walls or roof to draw icing
                </div>
            )}
        </div>
    )
}
