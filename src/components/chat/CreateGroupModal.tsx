'use client'

import { useState, useEffect, useRef } from 'react'
import { Users, Search, X, Loader2, Check, UserPlus } from 'lucide-react'
import { Avatar } from './Avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { useChatStore, type ChatUser } from '@/lib/chat-store'
import { apiFetch } from '@/lib/chat-utils'
import { toast } from 'sonner'

const MAX_GROUP_SIZE = 10
const avatarColors = [
  '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#ef4444', '#14b8a6', '#6366f1',
]

export function CreateGroupModal({ open, onOpenChange }: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [step, setStep] = useState<'info' | 'members'>('info')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [avatarColor, setAvatarColor] = useState(avatarColors[0])

  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<ChatUser[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const upsertGroup = useChatStore((s) => s.upsertGroup)
  const upsertChat = useChatStore((s) => s.upsertChat)
  const setActiveGroup = useChatStore((s) => s.setActiveGroup)
  const setMessages = useChatStore((s) => s.setMessages)
  const setShowCreateGroupModal = useChatStore((s) => s.setShowCreateGroupModal)

  useEffect(() => {
    if (open) {
      setStep('info')
      setName('')
      setDescription('')
      setAvatarColor(avatarColors[0])
      setQuery('')
      setSelected(new Set())
      loadUsers('')
    }
  }, [open])

  const loadUsers = async (q: string) => {
    setLoading(true)
    try {
      const endpoint = q.trim() ? `/api/users?action=search&q=${encodeURIComponent(q)}` : `/api/users?action=all`
      const data = await apiFetch<{ users: ChatUser[] }>(endpoint)
      setUsers(data.users)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadUsers(val), 300)
  }

  const toggleUser = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size + 1 > MAX_GROUP_SIZE - 1) {
          toast.error(`You can select at most ${MAX_GROUP_SIZE - 1} other members`)
          return prev
        }
        next.add(id)
      }
      return next
    })
  }

  const handleNext = () => {
    if (!name.trim()) {
      toast.error('Group name is required')
      return
    }
    if (name.trim().length < 2) {
      toast.error('Group name must be at least 2 characters')
      return
    }
    setStep('members')
  }

  const handleCreate = async () => {
    if (selected.size === 0) {
      toast.error('Please select at least one member')
      return
    }

    setCreating(true)
    try {
      const data = await apiFetch<{ group: any }>(`/api/groups`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          avatarColor,
          memberIds: Array.from(selected),
        }),
      })

      upsertGroup(data.group)
      upsertChat({
        id: data.group.id,
        isGroup: true,
        group: {
          id: data.group.id,
          name: data.group.name,
          description: data.group.description,
          avatarColor: data.group.avatarColor,
          creatorId: data.group.creatorId,
          memberCount: data.group.members.length,
        },
        lastMessage: null,
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
      })
      setMessages(data.group.id, [])
      setActiveGroup(data.group)

      // Notify members via WebSocket
      const socket = (window as any).__zapchat_socket
      if (socket) {
        socket.emit('group:new', {
          memberIds: Array.from(selected),
          group: data.group,
        })
      }

      onOpenChange(false)
      toast.success(`Group "${name}" created!`)
    } catch (e: any) {
      toast.error(e.message || 'Failed to create group')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {step === 'info' ? 'New group' : 'Select members'}
          </DialogTitle>
          <DialogDescription>
            {step === 'info'
              ? 'Create a new group with up to 10 members.'
              : `${selected.size} of ${MAX_GROUP_SIZE - 1} selected.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'info' ? (
          <div className="p-5 space-y-4">
            <div className="flex flex-col items-center pb-2">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-2xl text-white shadow-lg shadow-primary/20"
                style={{ background: avatarColor }}
              >
                <Users className="h-10 w-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="group-name">Group name *</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My awesome group"
                maxLength={50}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="group-desc">Description (optional)</Label>
              <Textarea
                id="group-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this group about?"
                maxLength={200}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Group color</Label>
              <div className="flex gap-2 flex-wrap">
                {avatarColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAvatarColor(c)}
                    className={`h-9 w-9 rounded-full transition-all ${
                      avatarColor === c
                        ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110'
                        : 'hover:scale-110'
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleNext}>
                Next
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col max-h-[60vh]">
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search by @username or name..."
                  className="pl-9"
                  autoFocus
                />
                {query && (
                  <button
                    onClick={() => handleSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            {selected.size > 0 && (
              <div className="px-3 py-2 border-b border-border bg-muted/30">
                <div className="flex gap-2 flex-wrap">
                  {Array.from(selected).map((id) => {
                    const user = users.find((u) => u.id === id)
                    if (!user) return null
                    return (
                      <button
                        key={id}
                        onClick={() => toggleUser(id)}
                        className="flex items-center gap-1.5 px-2 py-1 bg-background border border-border rounded-full text-xs hover:bg-muted"
                      >
                        <Avatar name={user.displayName} color={user.avatarColor} size="sm" className="h-5 w-5" />
                        <span>{user.displayName}</span>
                        <X className="h-3 w-3" />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <ScrollArea className="flex-1 h-72 scrollbar-thin">
              {loading && users.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center px-6">
                  <p className="text-sm font-medium mb-1">No users found</p>
                  <p className="text-xs text-muted-foreground">Try a different search.</p>
                </div>
              ) : (
                <div className="p-2 space-y-0.5">
                  {users.map((user) => {
                    const isSelected = selected.has(user.id)
                    return (
                      <button
                        key={user.id}
                        onClick={() => toggleUser(user.id)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left ${
                          isSelected ? 'bg-primary/10' : 'hover:bg-accent/50'
                        }`}
                      >
                        <Avatar name={user.displayName} color={user.avatarColor} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{user.displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                        </div>
                        <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-muted-foreground/40'
                        }`}>
                          {isSelected && <Check className="h-4 w-4" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>

            <div className="flex gap-2 p-3 border-t border-border">
              <Button variant="outline" className="flex-1" onClick={() => setStep('info')}>
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={selected.size === 0 || creating}
                onClick={handleCreate}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-1" />
                    Create ({selected.size})
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
