'use client'

import { useRef, useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Paperclip, Smile, ArrowLeft, Phone, Video, MoreVertical,
  Check, CheckCheck, Image as ImageIcon, File as FileIcon, X, Loader2
} from 'lucide-react'
import { Avatar } from './Avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useChatStore, type ChatMessage } from '@/lib/chat-store'
import { apiFetch, formatTimeFull, formatBytes } from '@/lib/chat-utils'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ChatWindowProps {
  onBack: () => void
  onOpenProfile: (userId: string) => void
}

const EMOJIS = ['😀', '😂', '❤️', '👍', '👎', '🔥', '🎉', '🙏', '😍', '😮', '😢', '🤔', '👀', '💯', '✨', '⚡', '🚀', '💎', '🌟', '💜']

export function ChatWindow({ onBack, onOpenProfile }: ChatWindowProps) {
  const activeChatId = useChatStore((s) => s.activeChatId)
  const otherUser = useChatStore((s) => s.activeChatOtherUser)
  const messagesByChat = useChatStore((s) => s.messagesByChat)
  const currentUser = useChatStore((s) => s.currentUser)
  const onlineUsers = useChatStore((s) => s.onlineUsers)
  const typingByUserId = useChatStore((s) => s.typingByUserId)
  const addMessage = useChatStore((s) => s.addMessage)
  const markChatRead = useChatStore((s) => s.markChatRead)
  const updateMessage = useChatStore((s) => s.updateMessage)
  const upsertChat = useChatStore((s) => s.upsertChat)

  const [input, setInput] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTypingSentRef = useRef<boolean>(false)

  const messages = activeChatId ? messagesByChat[activeChatId] || [] : []
  const isOnline = otherUser ? onlineUsers.some((u) => u.userId === otherUser.id) : false
  const isTyping = otherUser ? typingByUserId[otherUser.id] : false

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length, isTyping])

  // Mark as read when opening chat
  useEffect(() => {
    if (activeChatId && otherUser) {
      markChatRead(activeChatId)
      apiFetch(`/api/chats?action=read`, {
        method: 'PATCH',
        body: JSON.stringify({ chatId: activeChatId }),
      }).catch(() => {})

      // Load messages if we haven't loaded them yet for this chat
      const existing = useChatStore.getState().messagesByChat[activeChatId]
      if (!existing || existing.length === 0) {
        apiFetch<{ messages: ChatMessage[]; chatId: string }>(
          `/api/chats?action=messages&chatId=${activeChatId}&limit=200`
        )
          .then((data) => {
            if (data.messages && data.messages.length > 0) {
              useChatStore.getState().setMessages(activeChatId, data.messages)
            }
          })
          .catch((e) => console.error('[load messages]', e))
      }
    }
  }, [activeChatId, otherUser?.id, markChatRead])

  const handleSend = async () => {
    if (!input.trim() || !activeChatId || !otherUser || !currentUser) return
    const text = input.trim()
    setInput('')

    // Stop typing indicator
    sendTyping(false)

    // Create temp message
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const tempMessage: ChatMessage = {
      id: tempId,
      chatId: activeChatId,
      content: text,
      type: 'text',
      senderId: currentUser.id,
      receiverId: otherUser.id,
      read: false,
      createdAt: new Date().toISOString(),
      sender: {
        id: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.displayName,
        avatarColor: currentUser.avatarColor,
      },
      pending: true,
    }
    addMessage(activeChatId, tempMessage)

    // Update chat list preview
    upsertChat({
      id: activeChatId,
      otherUser,
      lastMessage: tempMessage,
      unreadCount: 0,
      updatedAt: new Date().toISOString(),
    })

    try {
      const data = await apiFetch<{ message: ChatMessage; tempId?: string }>(`/api/messages`, {
        method: 'POST',
        body: JSON.stringify({
          chatId: activeChatId,
          receiverId: otherUser.id,
          content: text,
          type: 'text',
          tempId,
        }),
      })
      updateMessage(activeChatId, tempId, data.message)
    } catch (e: any) {
      toast.error('Failed to send message')
      // Remove the temp message on failure
      updateMessage(activeChatId, tempId, { ...tempMessage, content: '⚠️ Failed to send: ' + text })
    }
  }

  const sendTyping = (isTyping: boolean) => {
    if (!otherUser || !currentUser) return
    const socket = (window as any).__zapchat_socket
    if (socket && socket.emit) {
      socket.emit('typing', {
        fromUserId: currentUser.id,
        fromUsername: currentUser.username,
        toUserId: otherUser.id,
        isTyping,
      })
    }
    lastTypingSentRef.current = isTyping
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    if (!otherUser) return
    // Throttle typing events
    if (!lastTypingSentRef.current) {
      sendTyping(true)
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false)
    }, 2000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeChatId || !otherUser || !currentUser) return

    setIsUploading(true)
    e.target.value = ''
    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await apiFetch<{ url: string; fileName: string; fileSize: number }>(`/api/upload`, {
        method: 'POST',
        body: formData,
      })

      const isImage = file.type.startsWith('image/')
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const tempMessage: ChatMessage = {
        id: tempId,
        chatId: activeChatId,
        content: isImage ? '📷 Photo' : `📎 ${file.name}`,
        type: isImage ? 'image' : 'file',
        fileUrl: uploadRes.url,
        fileName: uploadRes.fileName,
        fileSize: uploadRes.fileSize,
        senderId: currentUser.id,
        receiverId: otherUser.id,
        read: false,
        createdAt: new Date().toISOString(),
        sender: {
          id: currentUser.id,
          username: currentUser.username,
          displayName: currentUser.displayName,
          avatarColor: currentUser.avatarColor,
        },
        pending: true,
      }
      addMessage(activeChatId, tempMessage)
      upsertChat({
        id: activeChatId,
        otherUser,
        lastMessage: tempMessage,
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
      })

      const data = await apiFetch<{ message: ChatMessage }>(`/api/messages`, {
        method: 'POST',
        body: JSON.stringify({
          chatId: activeChatId,
          receiverId: otherUser.id,
          content: tempMessage.content,
          type: tempMessage.type,
          fileUrl: uploadRes.url,
          fileName: uploadRes.fileName,
          fileSize: uploadRes.fileSize,
          tempId,
        }),
      })
      updateMessage(activeChatId, tempId, data.message)
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeChatId) return
    try {
      await apiFetch(`/api/messages?id=${messageId}`, { method: 'DELETE' })
      // Remove locally
      const messages = useChatStore.getState().messagesByChat[activeChatId] || []
      useChatStore.getState().setMessages(
        activeChatId,
        messages.filter((m) => m.id !== messageId)
      )
      toast.success('Message deleted')
    } catch (e: any) {
      toast.error(e.message || 'Delete failed')
    }
  }

  if (!otherUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background chat-pattern-bg">
        <div className="text-center max-w-md p-6">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-accent/30 text-primary mb-4">
            <Send className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold mb-2">Welcome to ZapChat</h2>
          <p className="text-sm text-muted-foreground">
            Select a conversation from the sidebar, or start a new one to begin messaging.
            All your conversations are end-to-end secured and stored locally on your devices.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="h-16 px-3 sm:px-4 border-b border-border flex items-center gap-3 bg-card/80 backdrop-blur-md shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden -ml-1"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <button
          onClick={() => onOpenProfile(otherUser.id)}
          className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-90 transition-opacity text-left"
        >
          <Avatar
            name={otherUser.displayName}
            color={otherUser.avatarColor}
            size="md"
            online={isOnline}
          />
          <div className="min-w-0">
            <p className="font-semibold truncate">{otherUser.displayName}</p>
            <p className="text-xs text-muted-foreground truncate">
              {isTyping ? (
                <span className="text-primary inline-flex items-center gap-1">
                  typing
                  <span className="inline-flex">
                    <span className="animate-pulse-dot" style={{ animationDelay: '0s' }}>.</span>
                    <span className="animate-pulse-dot" style={{ animationDelay: '0.2s' }}>.</span>
                    <span className="animate-pulse-dot" style={{ animationDelay: '0.4s' }}>.</span>
                  </span>
                </span>
              ) : isOnline ? (
                <span className="text-green-500">online</span>
              ) : (
                `last seen ${formatTimeFull(otherUser.lastSeen)}`
              )}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="hidden sm:flex rounded-full" disabled title="Voice calls coming soon">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="hidden sm:flex rounded-full" disabled title="Video calls coming soon">
            <Video className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpenProfile(otherUser.id)}>
                View profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => toast.info('Clear chat — coming soon')}
              >
                Clear chat
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => toast.info('Block user — coming soon')}
              >
                Block user
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden chat-pattern-bg relative">
        <ScrollArea ref={scrollRef as any} className="h-full scrollbar-thin">
          <div className="min-h-full flex flex-col justify-end p-3 sm:p-4">
            <div className="space-y-1 max-w-3xl mx-auto w-full">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">
                    👋 Say hello to {otherUser.displayName}!
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isOwn = msg.senderId === currentUser?.id
                  const showAvatar = !isOwn && (idx === 0 || messages[idx - 1].senderId !== msg.senderId)
                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={isOwn}
                      showAvatar={showAvatar}
                      otherUser={otherUser}
                      onDelete={() => handleDeleteMessage(msg.id)}
                    />
                  )
                })
              )}
              {isTyping && (
                <div className="flex items-end gap-2 max-w-[70%]">
                  <Avatar name={otherUser.displayName} color={otherUser.avatarColor} size="sm" />
                  <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                    <span className="animate-pulse-dot text-lg" style={{ animationDelay: '0s' }}>.</span>
                    <span className="animate-pulse-dot text-lg" style={{ animationDelay: '0.2s' }}>.</span>
                    <span className="animate-pulse-dot text-lg" style={{ animationDelay: '0.4s' }}>.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Emoji picker */}
      <AnimatePresence>
        {showEmoji && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-20 left-4 z-20 bg-card border border-border rounded-xl shadow-xl p-3 grid grid-cols-10 gap-1 max-w-md"
          >
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  setInput((s) => s + emoji)
                  setShowEmoji(false)
                }}
                className="h-8 w-8 text-xl rounded hover:bg-accent transition-colors"
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="p-3 sm:p-4 border-t border-border bg-card/80 backdrop-blur-md shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Attach file"
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Paperclip className="h-5 w-5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full shrink-0"
            onClick={() => setShowEmoji((s) => !s)}
            title="Emoji"
          >
            <Smile className="h-5 w-5" />
          </Button>
          <Input
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 h-11 bg-background border-border"
            disabled={isUploading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isUploading}
            className="h-11 w-11 rounded-full p-0 shrink-0 shadow-lg shadow-primary/30"
            title="Send"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// MessageBubble
// ============================================================
function MessageBubble({
  message,
  isOwn,
  showAvatar,
  otherUser,
  onDelete,
}: {
  message: ChatMessage
  isOwn: boolean
  showAvatar: boolean
  otherUser: any
  onDelete: () => void
}) {
  const [imageOpen, setImageOpen] = useState(false)

  return (
    <div className={cn('flex items-end gap-2 group', isOwn ? 'justify-end' : 'justify-start')}>
      {!isOwn && (
        <div className="w-8 shrink-0">
          {showAvatar && <Avatar name={otherUser.displayName} color={otherUser.avatarColor} size="sm" />}
        </div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div
            className={cn(
              'max-w-[80%] sm:max-w-[70%] px-3 py-2 rounded-2xl cursor-pointer relative transition-all animate-message-in',
              isOwn
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-card border border-border rounded-bl-sm',
              message.pending && 'opacity-70'
            )}
          >
            {message.type === 'image' && message.fileUrl ? (
              <div className="space-y-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setImageOpen(true)
                  }}
                  className="block"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={message.fileUrl}
                    alt={message.fileName || 'image'}
                    className="rounded-lg max-h-64 max-w-full object-cover"
                  />
                </button>
                {message.content && message.content !== '📷 Photo' && (
                  <p className="text-sm">{message.content}</p>
                )}
              </div>
            ) : message.type === 'file' && message.fileUrl ? (
              <a
                href={message.fileUrl}
                download={message.fileName || 'file'}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-3 py-1 min-w-[200px]"
              >
                <div className="h-10 w-10 rounded-lg bg-background/20 flex items-center justify-center shrink-0">
                  <FileIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{message.fileName}</p>
                  {message.fileSize && (
                    <p className="text-xs opacity-70">{formatBytes(message.fileSize)}</p>
                  )}
                </div>
              </a>
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
            )}

            <div className={cn('flex items-center gap-1 mt-1 text-[10px]', isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
              {message.pending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <span>{formatTimeFull(message.createdAt)}</span>
                  {isOwn && (
                    message.read ? (
                      <CheckCheck className="h-3 w-3" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )
                  )}
                </>
              )}
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isOwn ? 'end' : 'start'}>
          {isOwn && (
            <>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                Delete message
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onClick={() => navigator.clipboard?.writeText(message.content)}
          >
            Copy text
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
