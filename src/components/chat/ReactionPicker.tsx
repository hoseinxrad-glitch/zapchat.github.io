'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef } from 'react'

const QUICK_REACTIONS = ['❤️', '😂', '👍', '🔥', '🎉', '😮', '😢', '🙏', '💯', '🚀']

interface ReactionPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (emoji: string) => void
  anchorRect?: DOMRect | null
}

export function ReactionPicker({ open, onClose, onSelect, anchorRect }: ReactionPickerProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  if (!open || !anchorRect) return null

  // Position above the anchor
  const top = anchorRect.top - 50
  const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - 320))

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 8, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.9 }}
        transition={{ duration: 0.15 }}
        style={{ top, left }}
        className="fixed z-50 bg-card border border-border rounded-full shadow-2xl px-2 py-1.5 flex gap-0.5"
      >
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onSelect(emoji)
              onClose()
            }}
            className="h-8 w-8 text-xl rounded-full hover:bg-accent hover:scale-125 transition-all"
            title={`React ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  )
}
