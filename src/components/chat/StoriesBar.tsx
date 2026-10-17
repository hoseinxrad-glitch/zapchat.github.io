'use client'

import { useEffect, useState } from 'react'
import { Plus, Loader2, Camera } from 'lucide-react'
import { Avatar } from './Avatar'
import { useExtendedStore, type StoryGroup } from '@/lib/extended-store'
import { useChatStore } from '@/lib/chat-store'
import { apiFetch } from '@/lib/chat-utils'
import { Button } from '@/components/ui/button'

interface StoriesBarProps {
  onOpenCreate: () => void
}

export function StoriesBar({ onOpenCreate }: StoriesBarProps) {
  const storyGroups = useExtendedStore((s) => s.storyGroups)
  const setStoryGroups = useExtendedStore((s) => s.setStoryGroups)
  const setShowStoriesViewer = useExtendedStore((s) => s.setShowStoriesViewer)
  const setViewingStoryGroupIndex = useExtendedStore((s) => s.setViewingStoryGroupIndex)
  const currentUser = useChatStore((s) => s.currentUser)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStories()
  }, [])

  const loadStories = async () => {
    setLoading(true)
    try {
      const data = await apiFetch<{ groups: StoryGroup[] }>('/api/stories?action=feed')
      setStoryGroups(data.groups || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const handleAddClick = () => {
    onOpenCreate()
  }

  const handleGroupClick = (index: number) => {
    setViewingStoryGroupIndex(index)
    setShowStoriesViewer(true)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-3 overflow-x-auto scrollbar-thin border-b border-border bg-card/50">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 p-3 overflow-x-auto scrollbar-thin border-b border-border bg-card/50">
      {/* Add Story */}
      <button
        onClick={handleAddClick}
        className="flex flex-col items-center gap-1 shrink-0"
        title="Add story"
      >
        <div className="relative">
          <Avatar
            name={currentUser?.displayName || 'You'}
            color={currentUser?.avatarColor || '#6366f1'}
            size="md"
          />
          <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-background">
            <Plus className="h-3 w-3" />
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">Your story</span>
      </button>

      {storyGroups.map((group, idx) => {
        const hasUnviewed = group.stories.some((s) => !s.viewedByMe && !s.isMine)
        return (
          <button
            key={group.user.id}
            onClick={() => handleGroupClick(idx)}
            className="flex flex-col items-center gap-1 shrink-0"
          >
            <div
              className="rounded-full p-0.5"
              style={{
                background: hasUnviewed
                  ? 'linear-gradient(45deg, #f59e0b, #ec4899, #8b5cf6)'
                  : 'var(--muted)',
              }}
            >
              <div className="bg-background rounded-full p-0.5">
                <Avatar
                  name={group.user.displayName}
                  color={group.user.avatarColor}
                  size="md"
                />
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">
              {group.user.displayName.split(' ')[0]}
            </span>
          </button>
        )
      })}

      {storyGroups.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
          <Camera className="h-4 w-4 mr-1.5" />
          No stories yet. Add yours!
        </div>
      )}
    </div>
  )
}
