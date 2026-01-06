import { useState, useEffect, useRef, useCallback } from 'react'

// Default volume as per PRD (30%)
const DEFAULT_VOLUME = 0.3

// Default playlist - add more tracks here
const DEFAULT_PLAYLIST = [
  '/music/background.mp3',
  // Add more tracks as needed:
  '/music/track2.mp3',
  '/music/track3.mp3',
]

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Hook for managing background music playback with playlist support
 * - Supports multiple tracks in a playlist
 * - Shuffles playlist order
 * - Automatically plays next track when current ends
 * - Loops through entire playlist
 * - Persists mute preference to localStorage
 * - Handles browser autoplay restrictions
 */
export function useBackgroundMusic(playlist = DEFAULT_PLAYLIST) {
  const audioRef = useRef(null)
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('musicMuted')
    return saved === 'true'
  })
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [shuffledPlaylist, setShuffledPlaylist] = useState(() => shuffleArray(playlist))
  const [currentTrackName, setCurrentTrackName] = useState('')

  // Get track name from path
  const getTrackName = useCallback((path) => {
    if (!path) return ''
    const filename = path.split('/').pop()
    // Remove extension and convert to readable name
    return filename
      .replace(/\.(mp3|ogg|wav)$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
  }, [])

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio()
    audio.volume = DEFAULT_VOLUME
    audio.muted = isMuted
    audioRef.current = audio

    // Handle audio errors gracefully
    audio.addEventListener('error', (e) => {
      console.warn('Background music failed to load:', e.message || 'File not found')
      // Try next track on error
      if (shuffledPlaylist.length > 1) {
        setCurrentTrackIndex(prev => (prev + 1) % shuffledPlaylist.length)
      }
    })

    audio.addEventListener('playing', () => {
      setIsPlaying(true)
    })

    audio.addEventListener('pause', () => {
      setIsPlaying(false)
    })

    // When track ends, play next track
    audio.addEventListener('ended', () => {
      if (shuffledPlaylist.length === 1) {
        // Single track - just loop it
        audio.currentTime = 0
        audio.play().catch(() => {})
      } else {
        // Multiple tracks - go to next
        setCurrentTrackIndex(prev => {
          const nextIndex = (prev + 1) % shuffledPlaylist.length
          // If we've looped back to start, reshuffle
          if (nextIndex === 0) {
            setShuffledPlaylist(shuffleArray(playlist))
          }
          return nextIndex
        })
      }
    })

    return () => {
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, []) // Only run once on mount

  // Update playlist if it changes
  useEffect(() => {
    setShuffledPlaylist(shuffleArray(playlist))
    setCurrentTrackIndex(0)
  }, [playlist.length])

  // Load and play current track
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || shuffledPlaylist.length === 0) return

    const currentTrack = shuffledPlaylist[currentTrackIndex]
    if (!currentTrack) return

    audio.src = currentTrack
    setCurrentTrackName(getTrackName(currentTrack))

    // Only try to play if user has interacted
    if (hasInteracted) {
      audio.play().catch((error) => {
        console.log('Autoplay prevented:', error.message)
      })
    }
  }, [currentTrackIndex, shuffledPlaylist, hasInteracted, getTrackName])

  // Update muted state when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted
    }
    localStorage.setItem('musicMuted', isMuted.toString())
  }, [isMuted])

  // Handle first user interaction to enable audio
  useEffect(() => {
    const handleInteraction = () => {
      if (!hasInteracted) {
        setHasInteracted(true)
      }
    }

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

  // Skip to next track
  const nextTrack = useCallback(() => {
    if (shuffledPlaylist.length <= 1) return
    setCurrentTrackIndex(prev => (prev + 1) % shuffledPlaylist.length)
  }, [shuffledPlaylist.length])

  // Skip to previous track
  const prevTrack = useCallback(() => {
    if (shuffledPlaylist.length <= 1) return
    setCurrentTrackIndex(prev =>
      prev === 0 ? shuffledPlaylist.length - 1 : prev - 1
    )
  }, [shuffledPlaylist.length])

  return {
    isMuted,
    isPlaying,
    toggleMute,
    setVolume,
    nextTrack,
    prevTrack,
    currentTrackName,
    currentTrackIndex,
    totalTracks: shuffledPlaylist.length,
    hasMultipleTracks: shuffledPlaylist.length > 1
  }
}
