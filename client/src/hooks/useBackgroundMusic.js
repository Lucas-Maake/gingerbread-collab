import { useState, useEffect, useRef, useCallback } from 'react'

// Default volume as per PRD (30%)
const DEFAULT_VOLUME = 0.3

/**
 * Hook for managing background music playback
 * - Loops seamlessly
 * - Persists mute preference to localStorage
 * - Handles browser autoplay restrictions
 */
export function useBackgroundMusic(audioSrc = '/music/background.mp3') {
  const audioRef = useRef(null)
  const [isMuted, setIsMuted] = useState(() => {
    // Load mute preference from localStorage
    const saved = localStorage.getItem('musicMuted')
    return saved === 'true'
  })
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio(audioSrc)
    audio.loop = true
    audio.volume = DEFAULT_VOLUME
    audio.muted = isMuted
    audioRef.current = audio

    // Handle audio errors gracefully
    audio.addEventListener('error', (e) => {
      console.warn('Background music failed to load:', e.message || 'File not found')
    })

    audio.addEventListener('playing', () => {
      setIsPlaying(true)
    })

    audio.addEventListener('pause', () => {
      setIsPlaying(false)
    })

    return () => {
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [audioSrc])

  // Update muted state when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted
    }
    localStorage.setItem('musicMuted', isMuted.toString())
  }, [isMuted])

  // Try to play music after user interaction (browser autoplay policy)
  useEffect(() => {
    if (!hasInteracted) return

    const audio = audioRef.current
    if (!audio) return

    // Attempt to play
    const playPromise = audio.play()
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        // Autoplay was prevented, will try again on next interaction
        console.log('Autoplay prevented:', error.message)
      })
    }
  }, [hasInteracted])

  // Handle first user interaction to enable audio
  useEffect(() => {
    const handleInteraction = () => {
      if (!hasInteracted) {
        setHasInteracted(true)
      }
    }

    // Listen for any user interaction
    window.addEventListener('click', handleInteraction, { once: true })
    window.addEventListener('keydown', handleInteraction, { once: true })

    return () => {
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
    }
  }, [hasInteracted])

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev)

    // Also try to play if not playing yet
    if (!isPlaying && audioRef.current) {
      audioRef.current.play().catch(() => {})
    }
  }, [isPlaying])

  // Set volume (0-1)
  const setVolume = useCallback((volume) => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume))
    }
  }, [])

  return {
    isMuted,
    isPlaying,
    toggleMute,
    setVolume
  }
}
