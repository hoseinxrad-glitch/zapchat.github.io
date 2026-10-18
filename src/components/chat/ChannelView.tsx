'use client'

import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Paperclip, Smile, ArrowLeft, Radio, MoreVertical,
  Check, CheckCheck, File as FileIcon, X, Loader2, Settings, Bell, BellOff, Users,
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
import { useExtendedStore, type Reaction, type Channel } from '@/lib/extended-store'
import { apiFetch, formatTimeFull, formatBytes } from '@/lib/chat-utils'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { MarkdownRenderer } from './MarkdownRenderer'
import { ReactionPicker } from './ReactionPicker'

const EMOJIS = ['😀', '😂', '❤️', '👍', '👎', '🔥', '🎉', '🙏', '😍', '😮', '😢', '🤔', '👀', '💯', '✨', '⚡', '🚀', '💎', '🌟', '💜']

interface ChannelViewProps {
  channel: Channel
  onBack: () => void
  onOpenAdmin: () => void
}

export function ChannelView({ channel, onBack, onOpenAdmin }: ChannelViewProps) {
  const currentUser = useChatStore((s) => s.currentUser)
  const onlineUsers = useChatStore((s) => s.onlineUsers)
  const reactionsByMessage = useExtendedStore((s) => s.reactionsByMessage)
  const setReactions = useExtendedStore((s) => s.setReactions)
  const toggleReactionLocal = useExtendedStore((s) => s.toggleReactionLocal)

  const [posts, setPosts] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [subscribed, setSubscribed] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isOwnerOrAdmin = channel.role === 'owner' || channel.role === 'admin'
  const creatorOnline = onlineUsers.some((u) => u.userId === channel.creatorId)

  useEffect(() => {
    loadChannel()
  }, [channel.id])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [posts.length])

  const loadChannel = async () => {
    setLoading(true)
    try {
      const data = await apiFetch<{ channel: any; posts: ChatMessage[] }>(`/api/channels/${channel.id}`)
      setPosts(data.posts || [])
      setSubscribed(!!data.channel.myRole)
      // Load reactions for each post
      data.posts?.forEach((p) => loadReactions(p.id))
    } catch (e: any) {
      toast.error(e.message || 'Failed to load channel')
    } finally {
      setLoading(false)
    }
  }

  const loadReactions = async (messageId: string) => {
    try {
      const data = await apiFetch<{ reactions: Reaction[] }>(`/api/reactions?messageId=${messageId}`)
      setReactions(messageId, data.reactions)
    } catch {}
  }

  const handleSend = async () => {
    if (!input.trim() || !currentUser) return
    if (!isOwnerOrAdmin) {
      toast.error('Only channel admins can post')
      return
    }
    const text = input.trim()
    setInput('')

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const tempMessage: ChatMessage = {
      id: tempId,
      channelId: channel.id,
      content: text,
      type: 'text',
      senderId: currentUser.id,
      read: false,
      createdAt: new Date().toISOString(),
      sender: {
        id: currentUser.id, username: currentUser.username,
        displayName: currentUser.displayName, avatarColor: currentUser.avatarColor,
      },
      pending: true,
    }
    setPosts((prev) => [...prev, tempMessage])

    try {
      const data = await apiFetch<{ message: ChatMessage; tempId?: string }>(`/api/messages`, {
        method: 'POST',
        body: JSON.stringify({
          channelId: channel.id,
          content: text,
          type: 'text',
          tempId,
        }),
      })
      setPosts((prev) => prev.map((p) => p.id === tempId ? data.message : p))

      // Broadcast via WS
      const socket = (window as any).__zapchat_socket
      if (socket) {
        // Get all subscriber IDs (we can do this via API since we're an admin)
        apiFetch<{ channel: any }>(`/api/channels/${channel.id}`)
          .then((d) => {
            const subs = (d.channel.members || []).map((m: any) => m.user.id).filter((id: string) => id !== currentUser.id)
            socket.emit('channel:post', {
              channelId: channel.id,
              message: data.message,
              subscriberIds: subs,
            })
          })
          .catch(() => {})
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to send')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUser) return
    setIsUploading(true)
    e.target.value = ''
    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await apiFetch<{ url: string; fileName: string; fileSize: number }>('/api/upload', {
        method: 'POST', body: formData,
      })

      const isImage = file.type.startsWith('image/')
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const tempMessage: ChatMessage = {
        id: tempId, channelId: channel.id,
        content: isImage ? '📷 Photo' : `📎 ${file.name}`,
        type: isImage ? 'image' : 'file',
        fileUrl: uploadRes.url, fileName: uploadRes.fileName, fileSize: uploadRes.fileSize,
        senderId: currentUser.id, read: false, createdAt: new Date().toISOString(),
        sender: {
          id: currentUser.id, username: currentUser.username,
          displayName: currentUser.displayName, avatarColor: currentUser.avatarColor,
        },
        pending: true,
      }
      setPosts((prev) => [...prev, tempMessage])

      const data = await apiFetch<{ message: ChatMessage }>('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          channelId: channel.id, content: tempMessage.content, type: tempMessage.type,
          fileUrl: uploadRes.url, fileName: uploadRes.fileName, fileSize: uploadRes.fileSize, tempId,
        }),
      })
      setPosts((prev) => prev.map((p) => p.id === tempId ? data.message : p))
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubscribe = async () => {
    try {
      if (subscribed) {
        await apiFetch(`/api/channels/${channel.id}/subscribe`, { method: 'DELETE' })
        setSubscribed(false)
        toast.success('Unsubscribed')
      } else {
        await apiFetch(`/api/channels/${channel.id}/subscribe`, { method: 'POST' })
        setSubscribed(true)
        toast.success('Subscribed!')
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed')
    }
  }

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser) return
    try {
      const data = await apiFetch<{ action: 'added' | 'removed' }>('/api/reactions', {
        method: 'POST',
        body: JSON.stringify({ messageId, emoji }),
      })
      toggleReactionLocal(messageId, emoji, currentUser.id, data.action)
    } catch (e: any) {
      toast.error(e.message || 'Reaction failed')
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Delete this post?')) return
    try {
      await apiFetch(`/api/messages?id=${postId}&action=both`, { method: 'DELETE' })
      setPosts((prev) => prev.filter((p) => p.id !== postId))
      toast.success('Post deleted')
    } catch (e: any) {
      toast.error(e.message || 'Delete failed')
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="h-16 px-3 sm:px-4 border-b border-border flex items-center gap-3 bg-card/80 backdrop-blur-md shrink-0">
        <Button variant="ghost" size="icon" className="md:hidden -ml-1" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center text-white ring-2 ring-background shrink-0"
            style={{ background: channel.avatarColor }}
          >
            <Radio className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{channel.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {channel.subscriberCount} {channel.subscriberCount === 1 ? 'subscriber' : 'subscribers'}
              {' · @' + channel.username}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!isOwnerOrAdmin && (
            <Button variant={subscribed ? 'outline' : 'default'} size="sm" onClick={handleSubscribe}>
              {subscribed ? 'Unsubscribe' : 'Subscribe'}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onOpenAdmin} disabled={channel.creatorId !== currentUser?.id}>
                <Settings className="h-4 w-4 mr-2" />
                Channel settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSubscribe}>
                {subscribed ? 'Unsubscribe' : 'Subscribe'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Channel info banner */}
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5 flex items-center gap-3">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-md"
          style={{ background: channel.avatarColor }}
        >
          <Radio className="h-7 w-7" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-base truncate">{channel.name}</h2>
          <p className="text-xs text-muted-foreground">
            {channel.subscriberCount} subscribers · @{channel.username}
          </p>
          {channel.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{channel.description}</p>
          )}
        </div>
      </div>

      {/* Posts */}
      <div className="flex-1 overflow-hidden chat-pattern-bg relative">
        <ScrollArea ref={scrollRef as any} className="h-full scrollbar-thin">
          <div className="min-h-full flex flex-col justify-end p-3 sm:p-4">
            <div className="space-y-3 max-w-3xl mx-auto w-full">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">
                    📢 No posts yet. {isOwnerOrAdmin ? 'Be the first to post!' : 'Check back later.'}
                  </p>
                </div>
              ) : (
                posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    channel={channel}
                    currentUser={currentUser}
                    reactions={reactionsByMessage[post.id] || []}
                    onToggleReaction={(emoji) => handleToggleReaction(post.id, emoji)}
                    onDelete={() => handleDeletePost(post.id)}
                  />
                ))
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

      {/* Input - only for admins/owners */}
      {isOwnerOrAdmin ? (
        <div className="p-3 sm:p-4 border-t border-border bg-card/80 backdrop-blur-md shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
            <Button
              variant="ghost" size="icon" className="rounded-full shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="Attach file"
            >
              {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full shrink-0" onClick={() => setShowEmoji((s) => !s)}>
              <Smile className="h-5 w-5" />
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Broadcast to ${channel.subscriberCount} subscribers...`}
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
      ) : (
        <div className="p-4 border-t border-border bg-muted/30 text-center">
          <p className="text-xs text-muted-foreground">
            🔇 You're a subscriber. Only channel admins can post.
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// PostCard - channel post with comments
// ============================================================
function PostCard({
  post, channel, currentUser, reactions, onToggleReaction, onDelete,
}: {
  post: ChatMessage
  channel: Channel
  currentUser: any
  reactions: Reaction[]
  onToggleReaction: (emoji: string) => void
  onDelete: () => void
}) {
  const [imageOpen, setImageOpen] = useState(false)
  const isOwn = post.senderId === currentUser?.id
  const canDelete = isOwn || channel.creatorId === currentUser?.id

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Author */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
        <Avatar name={post.sender?.displayName || 'Unknown'} color={post.sender?.avatarColor || '#6366f1'} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{post.sender?.displayName || 'Unknown'}</p>
          <p className="text-[10px] text-muted-foreground">@{post.sender?.username}</p>
        </div>
        <span className="text-[10px] text-muted-foreground">{formatTimeFull(post.createdAt)}</span>
        {canDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                Delete post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        {post.type === 'image' && post.fileUrl ? (
          <div className="space-y-2">
            <button onClick={() => setImageOpen(true)} className="block w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.fileUrl} alt={post.fileName || 'image'} className="rounded-lg max-h-96 max-w-full object-cover mx-auto" />
            </button>
            {post.content && post.content !== '📷 Photo' && (
              <MarkdownRenderer content={post.content} className="text-sm" />
            )}
          </div>
        ) : post.type === 'file' && post.fileUrl ? (
          <a href={post.fileUrl} download={post.fileName || 'file'} className="flex items-center gap-3 py-2">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <FileIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{post.fileName}</p>
              {post.fileSize && <p className="text-xs text-muted-foreground">{formatBytes(post.fileSize)}</p>}
            </div>
          </a>
        ) : (
          <MarkdownRenderer content={post.content} className="text-sm leading-relaxed" />
        )}

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-border">
            {reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onToggleReaction(r.emoji)}
                className={cn(
                  'flex items-center gap-0.5 px-2 py-1 rounded-full text-xs border transition-all',
                  r.mine ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-accent'
                )}
              >
                <span>{r.emoji}</span>
                <span className="font-medium">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Quick reaction bar */}
        <div className="flex items-center gap-1 mt-3">
          {['❤️', '👍', '🎉', '🔥'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => onToggleReaction(emoji)}
              className="h-7 w-7 text-base rounded-full hover:bg-accent transition-colors"
            >
              {emoji}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-[10px] text-muted-foreground">
            {post.read ? <CheckCheck className="h-3 w-3 inline text-primary" /> : <Check className="h-3 w-3 inline" />}
          </span>
        </div>
      </div>

      {/* Image preview modal */}
      {imageOpen && post.fileUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setImageOpen(false)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white p-2">
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.fileUrl} alt={post.fileName || 'image'} className="max-h-[90vh] max-w-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
