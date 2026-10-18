'use client'

import { useEffect, useState, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from './Avatar'
import { useExtendedStore } from '@/lib/extended-store'
import { useChatStore } from '@/lib/chat-store'
import { apiFetch, formatTimeFull } from '@/lib/chat-utils'

const STORY_DURATION = 5000 // 5 seconds per story

export function StoriesViewer() {
  const open = useExtendedStore((s) => s.showStoriesViewer)
  const setOpen = useExtendedStore((s) => s.setShowStoriesViewer)
  const storyGroups = useExtendedStore((s) => s.storyGroups)
  const setStoryGroups = useExtendedStore((s) => s.setStoryGroups)
  const groupIdx = useExtendedStore((s) => s.viewingStoryGroupIndex)
  const setGroupIdx = useExtendedStore((s) => s.setViewingStoryGroupIndex)
  const currentUser = useChatStore((s) => s.currentUser)

  const [storyIdx, setStoryIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const group = storyGroups[groupIdx]
  const story = group?.stories[storyIdx]

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStoryIdx(0)
        setProgress(0)
      }, 0)
      return () => clearTimeout(t)
    }
    // Mark as viewed
    if (group && story && !story.viewedByMe && !story.isMine) {
      apiFetch(`/api/stories/${story.id}/view`, { method: 'POST' }).catch(() => {})
      const newGroups = [...storyGroups]
      newGroups[groupIdx] = {
        ...group,
        stories: group.stories.map((s) => s.id === story.id ? { ...s, viewedByMe: true } : s),
      }
      setStoryGroups(newGroups)
    }
  }, [open, storyIdx, groupIdx])

  useEffect(() => {
    if (!open || !story) return
    const timeout = setTimeout(() => setProgress(0), 0)
    intervalRef.current = setInterval(() => {
      setProgress((p) => {
        const next = p + 100 / (STORY_DURATION / 50)
        if (next >= 100) {
          if (storyIdx < group.stories.length - 1) {
            setStoryIdx((i) => i + 1)
          } else if (groupIdx < storyGroups.length - 1) {
            setGroupIdx(groupIdx + 1)
            setStoryIdx(0)
          } else {
            setOpen(false)
          }
          return 0
        }
        return next
      })
    }, 50)
    return () => {
      clearTimeout(timeout)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [story, open, storyIdx, groupIdx, group, storyGroups.length, setOpen, setGroupIdx])

  if (!open || !group || !story) return null

  const handleNext = () => {
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx((i) => i + 1)
    } else if (groupIdx < storyGroups.length - 1) {
      setGroupIdx(groupIdx + 1)
      setStoryIdx(0)
    } else {
      setOpen(false)
    }
  }

  const handlePrev = () => {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1)
    } else if (groupIdx > 0) {
      setGroupIdx(groupIdx - 1)
      const prevGroup = storyGroups[groupIdx - 1]
      setStoryIdx(prevGroup.stories.length - 1)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
    >
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white"
        onClick={() => setOpen(false)}
      >
        <X className="h-6 w-6" />
      </button>

      {/* Story container */}
      <div className="relative w-full max-w-md aspect-[9/16] rounded-2xl overflow-hidden">
        {/* Progress bars */}
        <div className="absolute top-2 left-2 right-2 z-20 flex gap-1">
          {group.stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all"
                style={{ width: i < storyIdx ? '100%' : i === storyIdx ? `${progress}%` : '0%' }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-2 right-2 z-20 flex items-center gap-2 p-2">
          <Avatar name={group.user.displayName} color={group.user.avatarColor} size="sm" />
          <div className="flex-1">
            <p className="text-white text-sm font-semibold">{group.user.displayName}</p>
            <p className="text-white/60 text-xs">{formatTimeFull(story.createdAt)}</p>
          </div>
          {story.isMine && (
            <div className="flex items-center gap-1 text-white/80 text-xs">
              <Eye className="h-3.5 w-3.5" />
              {story.views}
            </div>
          )}
        </div>

        {/* Content */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={story.type === 'text' ? { background: story.bgColor } : {}}
        >
          {story.type === 'image' && story.mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.mediaUrl} alt="Story" className="max-h-full max-w-full object-cover" />
          ) : (
            <p className="text-white text-2xl font-bold text-center p-8">{story.text}</p>
          )}
        </div>

        {/* Tap zones */}
        <button
          className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
          onClick={handlePrev}
        />
        <button
          className="absolute right-0 top-0 bottom-0 w-2/3 z-10"
          onClick={handleNext}
        />

        {/* Nav arrows (visible on desktop) */}
        <button
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white"
          onClick={handlePrev}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white"
          onClick={handleNext}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </motion.div>
  )
}
