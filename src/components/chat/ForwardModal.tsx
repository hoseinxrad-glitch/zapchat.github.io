'use client'

import { useState, useEffect, useMemo } from 'react'
import { Loader2, Search, X, Forward, Check, Users, Radio, MessageCircle } from 'lucide-react'
import { Avatar } from './Avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { useChatStore, type ChatListItem } from '@/lib/chat-store'
import { useExtendedStore } from '@/lib/extended-store'
import { apiFetch } from '@/lib/chat-utils'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function ForwardModal() {
  const open = useExtendedStore((s) => s.showForwardModal)
  const setOpen = useExtendedStore((s) => s.setShowForwardModal)
  const sourceMessageId = useExtendedStore((s) => s.forwardSourceMessageId)
  const channels = useExtendedStore((s) => s.channels)
  const chats = useChatStore((s) => s.chats)
  const currentUser = useChatStore((s) => s.currentUser)
  const [search, setSearch] = useState('')
  const [forwarding, setForwarding] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSearch('')
      setForwarding(null)
      setDone(null)
    }
  }, [open])

  // Combine chats + channels into a unified target list
  const targets = useMemo(() => {
    const result: Array<{
      id: string
      type: 'chat' | 'group' | 'channel'
      name: string
      sub: string
      color: string
      icon: React.ReactNode
      targetChatId?: string
      targetGroupId?: string
      targetChannelId?: string
      targetReceiverId?: string
    }> = []

    chats.forEach((c) => {
      if (c.isGroup && c.group) {
        result.push({
          id: c.id, type: 'group',
          name: c.group.name, sub: `${c.group.memberCount} members`,
          color: c.group.avatarColor,
          icon: <Users className="h-5 w-5" />,
          targetGroupId: c.id,
        })
      } else if (c.otherUser) {
        result.push({
          id: c.id, type: 'chat',
          name: c.otherUser.displayName, sub: `@${c.otherUser.username}`,
          color: c.otherUser.avatarColor,
          icon: <MessageCircle className="h-5 w-5" />,
          targetChatId: c.id,
          targetReceiverId: c.otherUser.id,
        })
      }
    })

    channels.forEach((ch) => {
      result.push({
        id: ch.id, type: 'channel',
        name: ch.name, sub: `${ch.subscriberCount} subscribers · @${ch.username}`,
        color: ch.avatarColor,
        icon: <Radio className="h-5 w-5" />,
        targetChannelId: ch.id,
      })
    })

    if (!search.trim()) return result
    const q = search.toLowerCase()
    return result.filter((t) => t.name.toLowerCase().includes(q) || t.sub.toLowerCase().includes(q))
  }, [chats, channels, search])

  const handleForward = async (target: typeof targets[0]) => {
    if (!sourceMessageId) return
    setForwarding(target.id)
    try {
      const data = await apiFetch<{ message: any; recipientIds: string[] }>('/api/messages/forward', {
        method: 'POST',
        body: JSON.stringify({
          messageId: sourceMessageId,
          targetChatId: target.targetChatId,
          targetGroupId: target.targetGroupId,
          targetChannelId: target.targetChannelId,
          targetReceiverId: target.targetReceiverId,
        }),
      })

      // Add to the appropriate conversation's messages locally
      const convId = target.targetChatId || target.targetGroupId || target.targetChannelId
      if (convId) {
        useChatStore.getState().addMessage(convId, data.message)
        // Update chat preview
        const chat = chats.find((c) => c.id === convId)
        if (chat) {
          useChatStore.getState().upsertChat({ ...chat, lastMessage: data.message })
        }
      }

      // Broadcast via WebSocket
      const socket = (window as any).__zapchat_socket
      if (socket && data.recipientIds?.length > 0) {
        if (target.type === 'chat') {
          socket.emit('message:send', {
            messageId: data.message.id,
            chatId: target.targetChatId,
            senderId: currentUser?.id,
            receiverId: target.targetReceiverId,
            content: data.message.content,
            type: data.message.type,
            createdAt: data.message.createdAt,
          })
        } else if (target.type === 'group') {
          socket.emit('group:message:send', {
            messageId: data.message.id,
            groupId: target.targetGroupId,
            senderId: currentUser?.id,
            memberIds: data.recipientIds,
            payload: data.message,
          })
        }
      }

      setDone(target.id)
      toast.success(`Forwarded to ${target.name}`)
      setTimeout(() => {
        setOpen(false)
      }, 800)
    } catch (e: any) {
      toast.error(e.message || 'Forward failed')
    } finally {
      setForwarding(null)
    }
  }

  if (!sourceMessageId) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Forward className="h-5 w-5 text-primary" />
            Forward to
          </DialogTitle>
          <DialogDescription>
            Select a chat, group, or channel to forward this message.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="pl-9"
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-96 h-80 scrollbar-thin">
          {targets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center px-6">
              <p className="text-sm font-medium mb-1">No conversations found</p>
              <p className="text-xs text-muted-foreground">
                {search ? 'Try a different search.' : 'Start a chat or create a group/channel first.'}
              </p>
            </div>
          ) : (
            <div className="p-2">
              {targets.map((t) => {
                const isForwarding = forwarding === t.id
                const isDone = done === t.id
                return (
                  <button
                    key={`${t.type}-${t.id}`}
                    onClick={() => handleForward(t)}
                    disabled={isForwarding}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-colors text-left disabled:opacity-50"
                  >
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0"
                      style={{ background: t.color }}
                    >
                      {t.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.sub}</p>
                    </div>
                    {isDone ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : isForwarding ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Forward className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
