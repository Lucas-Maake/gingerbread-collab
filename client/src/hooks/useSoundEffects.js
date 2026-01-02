import { useCallback, useRef, useEffect } from 'react'

// Sound effect types
export const SoundType = {
  SPAWN: 'spawn',
  GRAB: 'grab',
  RELEASE: 'release',
  DELETE: 'delete',
  SNAP: 'snap',
  ROTATE: 'rotate',
  ERROR: 'error'
}

// Default volume for sound effects (50%)
const DEFAULT_VOLUME = 0.5

/**
 * Hook for playing sound effects using Web Audio API
 * Generates simple synthesized sounds for game actions
 */
export function useSoundEffects() {
  const audioContextRef = useRef(null)
  const isMutedRef = useRef(() => {
    const saved = localStorage.getItem('sfxMuted')
    return saved === 'true'
  })
  const volumeRef = useRef(DEFAULT_VOLUME)

  // Initialize AudioContext on first user interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
    }

    window.addEventListener('click', initAudio, { once: true })
    window.addEventListener('keydown', initAudio, { once: true })

    return () => {
      window.removeEventListener('click', initAudio)
      window.removeEventListener('keydown', initAudio)
    }
  }, [])

  /**
   * Play a simple tone
   */
  const playTone = useCallback((frequency, duration, type = 'sine', gainValue = 0.3) => {
    const ctx = audioContextRef.current
    if (!ctx || isMutedRef.current) return

    // Resume context if suspended
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)

    // Apply volume
    const finalGain = gainValue * volumeRef.current
    gainNode.gain.setValueAtTime(finalGain, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + duration)
  }, [])

  /**
   * Play a sequence of tones
   */
  const playSequence = useCallback((notes) => {
    const ctx = audioContextRef.current
    if (!ctx || isMutedRef.current) return

    let time = ctx.currentTime
    notes.forEach(({ freq, duration, type = 'sine', gain = 0.3 }) => {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.type = type
      oscillator.frequency.setValueAtTime(freq, time)

      const finalGain = gain * volumeRef.current
      gainNode.gain.setValueAtTime(finalGain, time)
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration)

      oscillator.start(time)
      oscillator.stop(time + duration)

      time += duration * 0.8 // Slight overlap
    })
  }, [])

  /**
   * Play a noise burst (for delete sound)
   */
  const playNoise = useCallback((duration, gain = 0.2) => {
    const ctx = audioContextRef.current
    if (!ctx || isMutedRef.current) return

    const bufferSize = ctx.sampleRate * duration
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const noise = ctx.createBufferSource()
    const gainNode = ctx.createGain()
    const filter = ctx.createBiquadFilter()

    noise.buffer = buffer
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1000, ctx.currentTime)

    noise.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(ctx.destination)

    const finalGain = gain * volumeRef.current
    gainNode.gain.setValueAtTime(finalGain, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

    noise.start(ctx.currentTime)
    noise.stop(ctx.currentTime + duration)
  }, [])

  /**
   * Play a sound effect by type
   */
  const playSound = useCallback((soundType) => {
    if (isMutedRef.current) return

    switch (soundType) {
      case SoundType.SPAWN:
        // Cheerful ascending arpeggio
        playSequence([
          { freq: 523, duration: 0.08, type: 'triangle', gain: 0.4 }, // C5
          { freq: 659, duration: 0.08, type: 'triangle', gain: 0.35 }, // E5
          { freq: 784, duration: 0.12, type: 'triangle', gain: 0.3 }, // G5
        ])
        break

      case SoundType.GRAB:
        // Short pop sound
        playTone(400, 0.08, 'sine', 0.3)
        setTimeout(() => playTone(600, 0.06, 'sine', 0.2), 30)
        break

      case SoundType.RELEASE:
        // Soft thud with gentle tone
        playTone(200, 0.15, 'sine', 0.25)
        playNoise(0.08, 0.1)
        break

      case SoundType.SNAP:
        // Satisfying click
        playTone(800, 0.05, 'square', 0.2)
        setTimeout(() => playTone(1200, 0.08, 'sine', 0.3), 20)
        break

      case SoundType.DELETE:
        // Descending sweep with noise
        playSequence([
          { freq: 400, duration: 0.08, type: 'sawtooth', gain: 0.25 },
          { freq: 250, duration: 0.1, type: 'sawtooth', gain: 0.2 },
          { freq: 150, duration: 0.12, type: 'sawtooth', gain: 0.15 },
        ])
        playNoise(0.15, 0.15)
        break

      case SoundType.ROTATE:
        // Quick tick
        playTone(600, 0.04, 'triangle', 0.15)
        break

      case SoundType.ERROR:
        // Warning buzz
        playTone(200, 0.15, 'sawtooth', 0.2)
        setTimeout(() => playTone(180, 0.15, 'sawtooth', 0.2), 150)
        break

      default:
        break
    }
  }, [playTone, playSequence, playNoise])

  /**
   * Toggle mute state
   */
  const toggleMute = useCallback(() => {
    isMutedRef.current = !isMutedRef.current
    localStorage.setItem('sfxMuted', isMutedRef.current.toString())
    return isMutedRef.current
  }, [])

  /**
   * Set volume (0-1)
   */
  const setVolume = useCallback((volume) => {
    volumeRef.current = Math.max(0, Math.min(1, volume))
  }, [])

  /**
   * Check if muted
   */
  const isMuted = useCallback(() => isMutedRef.current, [])

  return {
    playSound,
    toggleMute,
    setVolume,
    isMuted,
    SoundType
  }
}

// Singleton instance for use outside React components
let globalAudioContext = null
let globalMuted = localStorage.getItem('sfxMuted') === 'true'

export function playGlobalSound(soundType) {
  if (globalMuted) return

  if (!globalAudioContext) {
    globalAudioContext = new (window.AudioContext || window.webkitAudioContext)()
  }

  const ctx = globalAudioContext
  if (ctx.state === 'suspended') {
    ctx.resume()
  }

  const playTone = (freq, duration, type = 'sine', gain = 0.3) => {
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()
    osc.connect(gainNode)
    gainNode.connect(ctx.destination)
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gainNode.gain.setValueAtTime(gain * 0.5, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  }

  switch (soundType) {
    case SoundType.SPAWN:
      playTone(523, 0.08, 'triangle', 0.4)
      setTimeout(() => playTone(659, 0.08, 'triangle', 0.35), 60)
      setTimeout(() => playTone(784, 0.12, 'triangle', 0.3), 120)
      break
    case SoundType.GRAB:
      playTone(400, 0.08, 'sine', 0.3)
      setTimeout(() => playTone(600, 0.06, 'sine', 0.2), 30)
      break
    case SoundType.RELEASE:
      playTone(200, 0.15, 'sine', 0.25)
      break
    case SoundType.SNAP:
      playTone(800, 0.05, 'square', 0.2)
      setTimeout(() => playTone(1200, 0.08, 'sine', 0.3), 20)
      break
    case SoundType.DELETE:
      playTone(400, 0.08, 'sawtooth', 0.25)
      setTimeout(() => playTone(250, 0.1, 'sawtooth', 0.2), 60)
      setTimeout(() => playTone(150, 0.12, 'sawtooth', 0.15), 140)
      break
    case SoundType.ROTATE:
      playTone(600, 0.04, 'triangle', 0.15)
      break
    default:
      break
  }
}

export function setGlobalSfxMuted(muted) {
  globalMuted = muted
  localStorage.setItem('sfxMuted', muted.toString())
}

export function isGlobalSfxMuted() {
  return globalMuted
}
