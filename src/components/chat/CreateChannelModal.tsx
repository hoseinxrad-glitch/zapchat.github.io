'use client'

import { useState } from 'react'
import { Radio, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { useExtendedStore } from '@/lib/extended-store'
import { useChatStore } from '@/lib/chat-store'
import { apiFetch } from '@/lib/chat-utils'
import { toast } from 'sonner'

const COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#14b8a6']

export function CreateChannelModal({ open, onOpenChange }: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [avatarColor, setAvatarColor] = useState(COLORS[0])
  const [isPrivate, setIsPrivate] = useState(false)
  const [creating, setCreating] = useState(false)

  const upsertChannel = useExtendedStore((s) => s.upsertChannel)
  const socket = (typeof window !== 'undefined' ? (window as any).__zapchat_socket : null) as any
  const onlineUsers = useChatStore((s) => s.onlineUsers)

  const handleCreate = async () => {
    if (!username.trim() || !name.trim()) {
      toast.error('Username and name are required')
      return
    }
    setCreating(true)
    try {
      const data = await apiFetch<{ channel: any }>('/api/channels', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          name: name.trim(),
          description,
          avatarColor,
          isPrivate,
        }),
      })
      upsertChannel(data.channel)
      toast.success(`Channel @${data.channel.username} created!`)
      onOpenChange(false)
      setUsername('')
      setName('')
      setDescription('')
      setAvatarColor(COLORS[0])
      setIsPrivate(false)
    } catch (e: any) {
      toast.error(e.message || 'Failed to create channel')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            New Channel
          </DialogTitle>
          <DialogDescription>
            Broadcast messages to unlimited subscribers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-center pb-2">
            <div
              className="h-20 w-20 rounded-full flex items-center justify-center text-white shadow-lg"
              style={{ background: avatarColor }}
            >
              <Radio className="h-10 w-10" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ch-username">Channel username *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
              <Input
                id="ch-username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="my_channel"
                maxLength={32}
                className="pl-8"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              3-32 chars, start with letter, only letters/numbers/underscore
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ch-name">Channel name *</Label>
            <Input
              id="ch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Channel"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ch-desc">Description (optional)</Label>
            <Textarea
              id="ch-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this channel about?"
              maxLength={200}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Channel color</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAvatarColor(c)}
                  className={`h-9 w-9 rounded-full transition-all ${
                    avatarColor === c ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110' : 'hover:scale-110'
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <Label htmlFor="ch-private">Private channel</Label>
              <p className="text-xs text-muted-foreground">
                Private channels don't appear in search and require an invite link.
              </p>
            </div>
            <Switch
              id="ch-private"
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
            />
          </div>

          <Button
            className="w-full"
            disabled={creating}
            onClick={handleCreate}
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create channel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
