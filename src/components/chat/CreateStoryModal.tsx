'use client'

import { useState } from 'react'
import { Loader2, Image as ImageIcon, Type, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { useExtendedStore } from '@/lib/extended-store'
import { useChatStore } from '@/lib/chat-store'
import { apiFetch } from '@/lib/chat-utils'
import { toast } from 'sonner'

const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#ef4444', '#6366f1', '#14b8a6']
const DURATIONS = [
  { label: '6 hours', value: 6 },
  { label: '12 hours', value: 12 },
  { label: '24 hours', value: 24 },
  { label: '48 hours', value: 48 },
]

export function CreateStoryModal({ open, onOpenChange }: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [mode, setMode] = useState<'text' | 'image'>('text')
  const [text, setText] = useState('')
  const [bgColor, setBgColor] = useState(COLORS[0])
  const [duration, setDuration] = useState(24)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)

  const socket = (typeof window !== 'undefined' ? (window as any).__zapchat_socket : null) as any
  const currentUser = useChatStore((s) => s.currentUser)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiFetch<{ url: string }>('/api/upload', {
        method: 'POST',
        body: formData,
      })
      setImageUrl(res.url)
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleCreate = async () => {
    if (mode === 'text' && !text.trim()) {
      toast.error('Add some text first')
      return
    }
    if (mode === 'image' && !imageUrl) {
      toast.error('Upload an image first')
      return
    }
    setCreating(true)
    try {
      const data = await apiFetch<{ story: any }>('/api/stories', {
        method: 'POST',
        body: JSON.stringify({
          type: mode,
          mediaUrl: mode === 'image' ? imageUrl : undefined,
          text: mode === 'text' ? text.trim() : undefined,
          bgColor,
          duration,
        }),
      })

      // Notify all online users (since we don't have a follow graph)
      if (socket && currentUser) {
        // Get the list of online users from store
        const onlineUsers = useChatStore.getState().onlineUsers
        socket.emit('story:new', {
          followerIds: onlineUsers.map((u) => u.userId),
          story: { ...data.story, user: currentUser },
        })
      }

      toast.success('Story posted!')
      onOpenChange(false)
      setText('')
      setImageUrl(null)
      setBgColor(COLORS[0])
      setDuration(24)
      setMode('text')
    } catch (e: any) {
      toast.error(e.message || 'Failed to post story')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            New Story
          </DialogTitle>
          <DialogDescription>
            Stories disappear automatically after the chosen duration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setMode('text')}
              className={`py-2 text-sm rounded-md transition-colors ${mode === 'text' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
            >
              <Type className="h-4 w-4 inline mr-1.5" />
              Text
            </button>
            <button
              onClick={() => setMode('image')}
              className={`py-2 text-sm rounded-md transition-colors ${mode === 'image' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
            >
              <ImageIcon className="h-4 w-4 inline mr-1.5" />
              Image
            </button>
          </div>

          {/* Preview */}
          <div
            className="aspect-[9/16] rounded-xl flex items-center justify-center p-4 max-h-64 mx-auto"
            style={{ background: bgColor }}
          >
            {mode === 'text' ? (
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What's happening?"
                maxLength={200}
                className="bg-transparent border-none text-white placeholder-white/70 text-center text-lg font-bold resize-none focus-visible:ring-0"
                rows={3}
              />
            ) : imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Story" className="max-h-full max-w-full object-contain" />
            ) : (
              <label className="cursor-pointer flex flex-col items-center gap-2 text-white/80">
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <ImageIcon className="h-8 w-8" />
                )}
                <span className="text-sm">{uploading ? 'Uploading...' : 'Click to upload'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
            )}
          </div>

          {/* Color picker */}
          <div>
            <Label>Background color</Label>
            <div className="flex gap-2 flex-wrap mt-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBgColor(c)}
                  className={`h-8 w-8 rounded-full transition-all ${
                    bgColor === c ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110' : 'hover:scale-110'
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <Label>Duration</Label>
            <div className="grid grid-cols-4 gap-1 mt-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDuration(d.value)}
                  className={`py-1.5 text-xs rounded-md border transition-colors ${
                    duration === d.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            className="w-full"
            disabled={creating}
            onClick={handleCreate}
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post story'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
