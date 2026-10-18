'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Play, Pause, Loader2 } from 'lucide-react'

interface CircularVoicePlayerProps {
  src: string
  duration?: number | null
  waveform?: number[] | string | null
  senderColor?: string
  isOwn?: boolean
}

const SPEEDS = [1, 1.5, 2]
const SIZE = 56 // px (matches w-14 h-14)
const RADIUS = 22
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function CircularVoicePlayer({
  src, duration, waveform, senderColor = '#8b5cf6', isOwn,
}: CircularVoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [actualDuration, setActualDuration] = useState(duration || 0)
  const [speed, setSpeed] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  // Parse waveform
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
    audio.playbackRate = speed

    let loadingTimeout: NodeJS.Timeout | null = setTimeout(() => setIsLoading(true), 50)

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

  const progress = actualDuration > 0 ? currentTime / actualDuration : 0
  const totalDuration = actualDuration || duration || 0

  return (
    <div className="flex items-center gap-3 min-w-[200px] py-1">
      {/* Circular play button with waveform ring */}
      <button
        onClick={togglePlay}
        disabled={isLoading}
        className="relative shrink-0"
        style={{ width: SIZE, height: SIZE }}
      >
        <svg width={SIZE} height={SIZE} className="absolute inset-0 -rotate-90">
          {/* Background ring */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={isOwn ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.1)'}
            strokeWidth={2}
          />
          {/* Progress arc */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={isOwn ? '#fff' : senderColor}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            style={{ transition: 'stroke-dashoffset 0.1s linear' }}
          />
        </svg>
        {/* Inner circle background */}
        <div
          className="absolute inset-2 rounded-full flex items-center justify-center"
          style={{ backgroundColor: isOwn ? 'rgba(255,255,255,0.15)' : `${senderColor}25` }}
        >
          {/* Mini waveform bars inside the circle */}
          <div className="flex items-center gap-px h-3">
            {waveformBars.slice(0, 12).map((amp, i) => {
              const isActive = (i / 12) < progress
              return (
                <div
                  key={i}
                  className="w-px rounded-full transition-colors"
                  style={{
                    height: `${Math.max(20, Math.min(100, amp * 100))}%`,
                    backgroundColor: isActive
                      ? (isOwn ? '#fff' : senderColor)
                      : (isOwn ? 'rgba(255,255,255,0.4)' : `${senderColor}80`),
                  }}
                />
              )
            })}
          </div>
        </div>
        {/* Play/pause icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: isOwn ? '#fff' : senderColor }} />
          ) : isPlaying ? (
            <Pause className="h-4 w-4" style={{ color: isOwn ? '#fff' : senderColor }} fill="currentColor" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" style={{ color: isOwn ? '#fff' : senderColor }} fill="currentColor" />
          )}
        </div>
      </button>

      {/* Time + speed */}
      <div className="flex flex-col items-start gap-0.5 shrink-0">
        <span className="text-[11px] font-mono opacity-80">
          {isPlaying ? formatTime(currentTime) : formatTime(totalDuration)}
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
  const bars = []
  for (let i = 0; i < 40; i++) {
    bars.push(0.3 + Math.random() * 0.7)
  }
  return bars
}
