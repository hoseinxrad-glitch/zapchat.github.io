'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, UserPlus, Loader2, MessageCircle } from 'lucide-react'
import { Avatar } from './Avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { useChatStore, type ChatUser } from '@/lib/chat-store'
import { apiFetch, formatLastSeen } from '@/lib/chat-utils'
import { toast } from 'sonner'

export function NewChatModal({ open, onOpenChange }: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<ChatUser[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState<string | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const onlineUsers = useChatStore((s) => s.onlineUsers)
  const chats = useChatStore((s) => s.chats)
  const setActiveChat = useChatStore((s) => s.setActiveChat)
  const upsertChat = useChatStore((s) => s.upsertChat)
  const setMessages = useChatStore((s) => s.setMessages)

  // Load all users initially
  useEffect(() => {
    if (open) {
      loadUsers('')
      setQuery('')
    }
  }, [open])

  const loadUsers = async (q: string) => {
    setLoading(true)
    try {
      const endpoint = q.trim() ? `/api/users?action=search&q=${encodeURIComponent(q)}` : `/api/users?action=all`
      const data = await apiFetch<{ users: ChatUser[] }>(endpoint)
      setUsers(data.users)
    } catch (e) {
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

  const handleStartChat = async (user: ChatUser) => {
    setCreating(user.id)
    try {
      const data = await apiFetch<{ chat: any }>(`/api/chats`, {
        method: 'POST',
        body: JSON.stringify({ otherUserId: user.id }),
      })
      // Add to chat list if not exists
      upsertChat({
        id: data.chat.id,
        otherUser: data.chat.otherUser,
        lastMessage: null,
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
      })
      setMessages(data.chat.id, [])
      setActiveChat(data.chat.id, data.chat.otherUser)
      onOpenChange(false)
      toast.success(`Started chat with ${user.displayName}`)
    } catch (e: any) {
      toast.error(e.message || 'Failed to start chat')
    } finally {
      setCreating(null)
    }
  }

  const existingChatUserIds = new Set(chats.map((c) => c.otherUser.id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            New conversation
          </DialogTitle>
          <DialogDescription>
            Find anyone by username or display name.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by @username or name..."
              className="pl-9"
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

        <ScrollArea className="max-h-80 h-80 scrollbar-thin">
          {loading && users.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center px-6">
              <p className="text-sm font-medium mb-1">No users found</p>
              <p className="text-xs text-muted-foreground">
                {query ? 'Try a different search.' : 'Be the first to invite friends!'}
              </p>
            </div>
          ) : (
            <div className="p-2">
              {users.map((user) => {
                const isOnline = onlineUsers.some((u) => u.userId === user.id)
                const hasChat = existingChatUserIds.has(user.id)
                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-colors group"
                  >
                    <Avatar
                      name={user.displayName}
                      color={user.avatarColor}
                      size="md"
                      online={isOnline}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        @{user.username} · {isOnline ? 'online' : formatLastSeen(user.lastSeen)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={hasChat ? 'outline' : 'default'}
                      className="h-8 shrink-0"
                      disabled={creating === user.id}
                      onClick={() => handleStartChat(user)}
                    >
                      {creating === user.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : hasChat ? (
                        <>
                          <MessageCircle className="h-3.5 w-3.5 mr-1" />
                          Open
                        </>
                      ) : (
                        'Message'
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
