'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Download, ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight, Eye } from 'lucide-react'

interface ImageViewerProps {
  src: string
  fileName?: string | null
  isOpen: boolean
  onClose: () => void
}

export function ImageViewer({ src, fileName, isOpen, onClose }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const positionStart = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setZoom(1)
        setPosition({ x: 0, y: 0 })
      }, 0)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(5, z + 0.25))
      if (e.key === '-') setZoom((z) => Math.max(0.25, z - 0.25))
      if (e.key === '0') { setZoom(1); setPosition({ x: 0, y: 0 }) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom((z) => Math.max(0.25, Math.min(5, z + delta)))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY }
    positionStart.current = position
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setPosition({
      x: positionStart.current.x + dx,
      y: positionStart.current.y + dy,
    })
  }

  const handleMouseUp = () => setIsDragging(false)

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = src
    a.download = fileName || 'image'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const toggleFullscreen = async () => {
    const el = document.querySelector('[data-image-fullscreen]') as HTMLElement
    if (!el) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await el.requestFullscreen().catch(() => {})
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <span className="bg-black/40 backdrop-blur px-3 py-1.5 rounded-md text-xs">
            {fileName || 'Image'} · {Math.round(zoom * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            title="Zoom out (-)"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }) }}
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            title="Reset (0)"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            title="Zoom in (+)"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <a
            href={src}
            download={fileName || 'image'}
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </a>
          <button
            onClick={toggleFullscreen}
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            title="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div
        data-image-fullscreen
        className="max-w-full max-h-full overflow-hidden flex items-center justify-center"
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={fileName || 'image'}
          className="max-w-full max-h-[90vh] object-contain transition-transform"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
          draggable={false}
        />
      </div>

      {/* Hint */}
      {zoom === 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs bg-black/40 backdrop-blur px-3 py-1.5 rounded-full pointer-events-none">
          Scroll to zoom · Drag to pan · Esc to close
        </div>
      )}
    </div>
  )
}
