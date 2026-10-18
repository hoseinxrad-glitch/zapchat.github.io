'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize, Download, Loader2, RotateCcw } from 'lucide-react'

interface VideoPlayerProps {
  src: string
  thumbnail?: string | null
  duration?: number | null
  fileName?: string | null
  fileSize?: number | null
  senderColor?: string
  isOwn?: boolean
  isSpoiler?: boolean
}

const SPEEDS = [0.5, 1, 1.5, 2]

export function VideoPlayer({
  src, thumbnail, duration, fileName, fileSize,
  senderColor = '#8b5cf6', isOwn, isSpoiler,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [actualDuration, setActualDuration] = useState(duration || 0)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [showControls, setShowControls] = useState(true)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [revealed, setRevealed] = useState(!isSpoiler)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    const onLoaded = () => {
      setActualDuration(duration || v.duration || 0)
      setIsLoading(false)
    }
    const onTimeUpdate = () => setCurrentTime(v.currentTime)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onWaiting = () => setIsLoading(true)
    const onPlaying = () => setIsLoading(false)

    v.addEventListener('loadedmetadata', onLoaded)
    v.addEventListener('timeupdate', onTimeUpdate)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('waiting', onWaiting)
    v.addEventListener('playing', onPlaying)

    return () => {
      v.removeEventListener('loadedmetadata', onLoaded)
      v.removeEventListener('timeupdate', onTimeUpdate)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('waiting', onWaiting)
      v.removeEventListener('playing', onPlaying)
    }
  }, [duration])

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (isPlaying) v.pause()
    else v.play()
    showControlsBriefly()
  }

  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setIsMuted(v.muted)
  }

  const handleVolumeChange = (newVol: number) => {
    const v = videoRef.current
    if (!v) return
    v.volume = newVol
    v.muted = newVol === 0
    setVolume(newVol)
    setIsMuted(newVol === 0)
  }

  const cycleSpeed = () => {
    const nextIdx = (SPEEDS.indexOf(speed) + 1) % SPEEDS.length
    const nextSpeed = SPEEDS[nextIdx]
    setSpeed(nextSpeed)
    if (videoRef.current) videoRef.current.playbackRate = nextSpeed
  }

  const seekTo = (fraction: number) => {
    const v = videoRef.current
    if (!v || !actualDuration) return
    v.currentTime = fraction * actualDuration
    setCurrentTime(v.currentTime)
  }

  const toggleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      el.requestFullscreen().catch(() => {})
    }
  }

  const restart = () => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = 0
    v.play()
  }

  const showControlsBriefly = () => {
    setShowControls(true)
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current)
    if (isPlaying) {
      hideControlsTimerRef.current = setTimeout(() => setShowControls(false), 3000)
    }
  }

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = src
    a.download = fileName || 'video'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const progress = actualDuration > 0 ? currentTime / actualDuration : 0

  // Spoiler overlay
  if (!revealed) {
    return (
      <div className="relative w-full max-w-md aspect-video rounded-xl bg-black/80 flex flex-col items-center justify-center cursor-pointer overflow-hidden group"
           onClick={() => setRevealed(true)}>
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-pink-900/50 backdrop-blur-md" />
        <div className="relative z-10 text-center p-4">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur mb-3 group-hover:scale-110 transition-transform">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-white font-medium text-sm">Spoiler</p>
          <p className="text-white/70 text-xs mt-1">Click to reveal</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full max-w-md rounded-xl overflow-hidden bg-black group ${isFullscreen ? 'aspect-auto h-full' : 'aspect-video'}`}
      onMouseMove={showControlsBriefly}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        poster={thumbnail || undefined}
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        preload="metadata"
        playsInline
      />

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="h-8 w-8 text-white animate-spin" />
        </div>
      )}

      {/* Play button overlay (when paused) */}
      {!isPlaying && !isLoading && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
        >
          <div className="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
            <Play className="h-8 w-8 text-black ml-1" fill="currentColor" />
          </div>
        </button>
      )}

      {/* Controls */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 transition-opacity ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Progress bar */}
        <div
          className="relative h-1 bg-white/30 rounded-full mb-2 cursor-pointer group/progress"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            seekTo((e.clientX - rect.left) / rect.width)
          }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${progress * 100}%`,
              backgroundColor: senderColor,
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow opacity-0 group-hover/progress:opacity-100 transition-opacity"
            style={{ left: `calc(${progress * 100}% - 6px)` }}
          />
        </div>

        <div className="flex items-center gap-2 text-white">
          <button onClick={togglePlay} className="hover:scale-110 transition-transform" title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
          </button>
          <button onClick={restart} className="hover:scale-110 transition-transform" title="Restart">
            <RotateCcw className="h-4 w-4" />
          </button>

          {/* Volume */}
          <div
            className="flex items-center gap-1"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button onClick={toggleMute} className="hover:scale-110 transition-transform">
              {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            {showVolumeSlider && (
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 accent-white h-1"
              />
            )}
          </div>

          <span className="text-xs font-mono">
            {formatTime(currentTime)} / {formatTime(actualDuration)}
          </span>

          <div className="flex-1" />

          <button onClick={cycleSpeed} className="text-xs font-bold hover:scale-110 transition-transform" title="Playback speed">
            {speed}x
          </button>

          <a
            href={src}
            download={fileName || 'video'}
            onClick={(e) => e.stopPropagation()}
            className="hover:scale-110 transition-transform"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </a>

          <button onClick={toggleFullscreen} className="hover:scale-110 transition-transform" title="Fullscreen">
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* File info overlay (top-left) */}
      {fileName && (
        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-xs px-2 py-1 rounded-md max-w-[60%] truncate pointer-events-none">
          📹 {fileName}
        </div>
      )}
    </div>
  )
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
