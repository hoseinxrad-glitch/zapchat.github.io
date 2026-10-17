'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Play, Pause, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AudioPlayerProps {
  src: string
  duration?: number | null
  waveform?: number[] | string | null
  senderColor?: string
  isOwn?: boolean
}

const SPEEDS = [1, 1.5, 2]

export function AudioPlayer({ src, duration, waveform, senderColor = '#8b5cf6', isOwn }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [actualDuration, setActualDuration] = useState(duration || 0)
  const [speed, setSpeed] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  // Parse waveform — use useMemo instead of useEffect
  const waveformBars = useMemo(() => {
    if (typeof waveform === 'string') {
      try {
        const parsed = JSON.parse(waveform)
        return Array.isArray(parsed) ? parsed : generateFakeWaveform()
      } catch {
        return generateFakeWaveform()
      }
    } else if (Array.isArray(waveform) && waveform.length > 0) {
      return waveform
    }
    return generateFakeWaveform()
  }, [waveform])

  useEffect(() => {
    const audio = new Audio(src)
    audioRef.current = audio
    audio.preload = 'metadata'

    let loadingTimeout: NodeJS.Timeout | null = setTimeout(() => {
      setIsLoading(true)
    }, 50)

    const onLoaded = () => {
      if (loadingTimeout) { clearTimeout(loadingTimeout); loadingTimeout = null }
      setActualDuration(duration || audio.duration || 0)
      setIsLoading(false)
    }
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }
    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)

    return () => {
      if (loadingTimeout) clearTimeout(loadingTimeout)
      audio.pause()
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
    }
  }, [src, duration])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const cycleSpeed = () => {
    const nextIdx = (SPEEDS.indexOf(speed) + 1) % SPEEDS.length
    const nextSpeed = SPEEDS[nextIdx]
    setSpeed(nextSpeed)
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed
  }

  const seekTo = (fraction: number) => {
    if (!audioRef.current || !actualDuration) return
    audioRef.current.currentTime = fraction * actualDuration
    setCurrentTime(audioRef.current.currentTime)
  }

  const progress = actualDuration > 0 ? currentTime / actualDuration : 0
  const totalDuration = actualDuration || duration || 0

  return (
    <div className="flex items-center gap-3 min-w-[240px] py-1">
      <Button
        variant={isOwn ? 'secondary' : 'default'}
        size="icon"
        className="h-9 w-9 rounded-full shrink-0"
        style={!isOwn ? { backgroundColor: senderColor } : {}}
        onClick={togglePlay}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" />
        )}
      </Button>

      {/* Waveform / progress */}
      <div
        className="flex-1 flex items-center gap-px h-8 cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const x = e.clientX - rect.left
          seekTo(Math.max(0, Math.min(1, x / rect.width)))
        }}
      >
        {waveformBars.map((amp, i) => {
          const barProgress = waveformBars.length > 0 ? i / waveformBars.length : 0
          const isPlayed = barProgress < progress
          return (
            <div
              key={i}
              className="flex-1 rounded-full transition-colors"
              style={{
                height: `${Math.max(15, Math.min(100, amp * 100))}%`,
                backgroundColor: isPlayed
                  ? (isOwn ? '#fff' : senderColor)
                  : (isOwn ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)'),
              }}
            />
          )
        })}
      </div>

      {/* Time + Speed */}
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="text-[10px] opacity-70">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>
        <button
          onClick={cycleSpeed}
          className="text-[10px] font-bold px-1.5 py-0.5 rounded hover:bg-foreground/10 transition-colors"
          style={{ color: isOwn ? '#fff' : senderColor }}
        >
          {speed}x
        </button>
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function generateFakeWaveform(): number[] {
  // Generate a deterministic-ish waveform based on time
  const bars = []
  for (let i = 0; i < 40; i++) {
    bars.push(0.3 + Math.random() * 0.7)
  }
  return bars
}
