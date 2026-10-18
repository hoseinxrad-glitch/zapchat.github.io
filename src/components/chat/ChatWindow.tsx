'use client'

import { useRef, useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Paperclip, Smile, ArrowLeft, Phone, Video, MoreVertical,
  Check, CheckCheck, File as FileIcon, X, Loader2, Users, Settings,
  Reply, Edit2, Pin, Trash2, Copy, Bell, BellOff, Image as ImageIcon, Mic,
  Forward, EyeOff, Film, Music, Download,
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
import { useExtendedStore, type Reaction } from '@/lib/extended-store'
import { apiFetch, formatTimeFull, formatBytes } from '@/lib/chat-utils'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ReactionPicker } from './ReactionPicker'
import { MarkdownRenderer } from './MarkdownRenderer'
import { VoiceRecorder } from './VoiceRecorder'
import { CircularVoicePlayer as AudioPlayer } from './CircularVoicePlayer'
import { VideoPlayer } from './VideoPlayer'
import { ImageViewer } from './ImageViewer'

const EMOJIS = ['😀', '😂', '❤️', '👍', '👎', '🔥', '🎉', '🙏', '😍', '😮', '😢', '🤔', '👀', '💯', '✨', '⚡', '🚀', '💎', '🌟', '💜']

interface ChatWindowProps {
  onBack: () => void
  onOpenUserProfile: (userId: string) => void
  onOpenGroupInfo: (groupId: string) => void
  onOpenGroupSettings: (groupId: string) => void
  onOpenChatSettings: (chatId?: string, groupId?: string) => void
}

export function ChatWindow({
  onBack, onOpenUserProfile, onOpenGroupInfo,
  onOpenGroupSettings, onOpenChatSettings,
}: ChatWindowProps) {
  const activeConversation = useChatStore((s) => s.activeConversation)
  const messagesByConversation = useChatStore((s) => s.messagesByConversation)
  const currentUser = useChatStore((s) => s.currentUser)
  const onlineUsers = useChatStore((s) => s.onlineUsers)
  const typingByUserId = useChatStore((s) => s.typingByUserId)
  const typingByGroup = useChatStore((s) => s.typingByGroup)
  const addMessage = useChatStore((s) => s.addMessage)
  const updateMessage = useChatStore((s) => s.updateMessage)
  const removeMessage = useChatStore((s) => s.removeMessage)
  const markChatRead = useChatStore((s) => s.markChatRead)
  const upsertChat = useChatStore((s) => s.upsertChat)

  // Extended store for replies, edits, reactions, etc.
  const replyTo = useExtendedStore((s) => s.replyTo)
  const setReplyTo = useExtendedStore((s) => s.setReplyTo)
  const editingMessage = useExtendedStore((s) => s.editingMessage)
  const setEditingMessage = useExtendedStore((s) => s.setEditingMessage)
  const reactionsByMessage = useExtendedStore((s) => s.reactionsByMessage)
  const setReactions = useExtendedStore((s) => s.setReactions)
  const toggleReactionLocal = useExtendedStore((s) => s.toggleReactionLocal)
  const pinnedMessages = useExtendedStore((s) => s.pinnedMessages)
  const setPinnedMessage = useExtendedStore((s) => s.setPinnedMessage)
  const silentSend = useExtendedStore((s) => s.silentSend)
  const setSilentSend = useExtendedStore((s) => s.setSilentSend)
  const spoilerSend = useExtendedStore((s) => s.spoilerSend)
  const setSpoilerSend = useExtendedStore((s) => s.setSpoilerSend)
  const call = useExtendedStore((s) => s.call)
  const setCall = useExtendedStore((s) => s.setCall)

  const [input, setInput] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTypingSentRef = useRef<boolean>(false)

  const isGroup = activeConversation?.type === 'group'
  const activeId = isGroup
    ? activeConversation!.groupId
    : activeConversation?.type === 'direct'
    ? activeConversation!.chatId
    : null

  const otherUser = !isGroup && activeConversation?.type === 'direct'
    ? activeConversation.otherUser
    : null

  const group = isGroup ? activeConversation!.group : null

  const messages = activeId ? messagesByConversation[activeId] || [] : []
  const isOnline = otherUser ? onlineUsers.some((u) => u.userId === otherUser.id) : false
  const isTyping = isGroup && group
    ? typingByGroup[group.id]
    : otherUser
    ? typingByUserId[otherUser.id]
    : false

  // When editing message changes, sync input
  useEffect(() => {
    if (editingMessage) {
      setInput(editingMessage.content)
    } else if (!replyTo) {
      setInput('')
    }
  }, [editingMessage])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length, isTyping])

  // Load messages + reactions when opening a chat
  useEffect(() => {
    if (!activeId || !activeConversation) return

    markChatRead(activeId)
    if (!isGroup && otherUser) {
      apiFetch('/api/chats?action=read', {
        method: 'PATCH',
        body: JSON.stringify({ chatId: activeId }),
      }).catch(() => {})
    } else if (isGroup) {
      apiFetch(`/api/groups/${activeId}/messages?action=read`, { method: 'PATCH' }).catch(() => {})
    }

    const existing = useChatStore.getState().messagesByConversation[activeId]
    if (!existing || existing.length === 0) {
      const endpoint = isGroup
        ? `/api/groups/${activeId}/messages?limit=200`
        : `/api/chats?action=messages&chatId=${activeId}&limit=200`
      apiFetch<{ messages: ChatMessage[] }>(endpoint)
        .then((data) => {
          if (data.messages?.length > 0) {
            useChatStore.getState().setMessages(activeId, data.messages)
            // Load reactions for each message
            data.messages.forEach((msg) => loadReactions(msg.id))
          }
        })
        .catch((e) => console.error('[load messages]', e))
    } else {
      // Load reactions for existing messages
      existing.forEach((msg) => {
        if (!reactionsByMessage[msg.id]) loadReactions(msg.id)
      })
    }

    // Load pinned message
    if (isGroup && group) {
      apiFetch<{ group: any }>(`/api/groups/${activeId}`).then((data) => {
        if (data.group?.pinnedMessageId) {
          apiFetch<{ messages: ChatMessage[] }>(`/api/groups/${activeId}/messages?limit=200`)
            .then((d) => {
              const pinned = d.messages.find((m) => m.id === data.group.pinnedMessageId)
              if (pinned) setPinnedMessage(activeId, pinned)
            })
            .catch(() => {})
        }
      }).catch(() => {})
    }
  }, [activeId, isGroup, markChatRead])

  const loadReactions = async (messageId: string) => {
    try {
      const data = await apiFetch<{ reactions: Reaction[] }>(`/api/reactions?messageId=${messageId}`)
      setReactions(messageId, data.reactions)
    } catch {}
  }

  const handleSend = async () => {
    if (!input.trim() || !activeId || !currentUser || !activeConversation) return
    const text = input.trim()
    setInput('')
    sendTyping(false)

    // If editing an existing message
    if (editingMessage) {
      try {
        const data = await apiFetch<{ message: ChatMessage; recipientIds: string[] }>(
          '/api/messages?action=edit',
          {
            method: 'PATCH',
            body: JSON.stringify({ id: editingMessage.id, content: text }),
          }
        )
        // Update locally
        useChatStore.getState().setMessages(
          activeId,
          (useChatStore.getState().messagesByConversation[activeId] || []).map((m) =>
            m.id === editingMessage.id ? { ...data.message, pending: false } : m
          )
        )
        // Broadcast via WS
        const socket = (window as any).__zapchat_socket
        if (socket && data.recipientIds?.length > 0) {
          socket.emit('message:edited', {
            message: data.message,
            recipientIds: data.recipientIds,
          })
        }
        setEditingMessage(null)
        toast.success('Message edited')
      } catch (e: any) {
        toast.error(e.message || 'Edit failed')
      }
      return
    }

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    if (isGroup && group) {
      // Group message
      const tempMessage: ChatMessage = {
        id: tempId,
        groupId: activeId,
        content: text,
        type: 'text',
        senderId: currentUser.id,
        receiverId: null,
        read: false,
        createdAt: new Date().toISOString(),
        sender: {
          id: currentUser.id, username: currentUser.username,
          displayName: currentUser.displayName, avatarColor: currentUser.avatarColor,
        },
        pending: true,
        silent: silentSend,
        replyToId: replyTo?.id,
      }
      addMessage(activeId, tempMessage)
      upsertChat({
        id: activeId, isGroup: true,
        group: {
          id: group.id, name: group.name, description: group.description,
          avatarColor: group.avatarColor, creatorId: group.creatorId,
          memberCount: group.members.length,
        },
        lastMessage: tempMessage, unreadCount: 0, updatedAt: new Date().toISOString(),
      })

      try {
        const data = await apiFetch<{ message: ChatMessage; memberIds: string[]; tempId?: string }>(
          '/api/messages',
          {
            method: 'POST',
            body: JSON.stringify({
              groupId: activeId, content: text, type: 'text',
              replyToId: replyTo?.id, silent: silentSend, isSpoiler: spoilerSend, tempId,
            }),
          }
        )
        updateMessage(activeId, tempId, data.message)

        const socket = (window as any).__zapchat_socket
        if (socket && data.memberIds?.length > 0) {
          socket.emit('group:message:send', {
            messageId: data.message.id, groupId: activeId,
            senderId: currentUser.id, memberIds: data.memberIds, payload: data.message,
          })
        }
        setReplyTo(null)
      } catch (e: any) {
        toast.error('Failed to send')
      }
      return
    }

    // Direct message
    if (!otherUser) return
    const tempMessage: ChatMessage = {
      id: tempId,
      chatId: activeId,
      content: text,
      type: 'text',
      senderId: currentUser.id,
      receiverId: otherUser.id,
      read: false,
      createdAt: new Date().toISOString(),
      sender: {
        id: currentUser.id, username: currentUser.username,
        displayName: currentUser.displayName, avatarColor: currentUser.avatarColor,
      },
      pending: true,
      silent: silentSend,
      replyToId: replyTo?.id,
    }
    addMessage(activeId, tempMessage)
    upsertChat({
      id: activeId, isGroup: false, otherUser,
      lastMessage: tempMessage, unreadCount: 0, updatedAt: new Date().toISOString(),
    })

    try {
      const data = await apiFetch<{ message: ChatMessage; tempId?: string }>('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          chatId: activeId, receiverId: otherUser.id, content: text, type: 'text',
          replyToId: replyTo?.id, silent: silentSend, isSpoiler: spoilerSend, tempId,
        }),
      })
      updateMessage(activeId, tempId, data.message)

      const socket = (window as any).__zapchat_socket
      if (socket) {
        socket.emit('message:send', {
          messageId: data.message.id, chatId: activeId,
          senderId: currentUser.id, receiverId: otherUser.id,
          content: data.message.content, type: data.message.type,
          createdAt: data.message.createdAt,
        })
      }
      setReplyTo(null)
      setSpoilerSend(false)
    } catch (e: any) {
      toast.error('Failed to send')
    }
  }

  const sendTyping = (isTyping: boolean) => {
    if (!currentUser || !activeConversation) return
    const socket = (window as any).__zapchat_socket
    if (!socket) return

    if (isGroup && group) {
      const memberIds = group.members
        .filter((m) => m.user.id !== currentUser.id)
        .map((m) => m.user.id)
      socket.emit('group:typing', {
        groupId: group.id, fromUserId: currentUser.id,
        fromUsername: currentUser.username, fromDisplayName: currentUser.displayName,
        memberIds, isTyping,
      })
    } else if (otherUser) {
      socket.emit('typing', {
        fromUserId: currentUser.id, fromUsername: currentUser.username,
        toUserId: otherUser.id, isTyping,
      })
    }
    lastTypingSentRef.current = isTyping
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    if (editingMessage) return // don't send typing while editing
    if (!lastTypingSentRef.current) sendTyping(true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 2000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      setReplyTo(null)
      setEditingMessage(null)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, isImage: boolean) => {
    const file = e.target.files?.[0]
    if (!file || !activeId || !currentUser || !activeConversation) return

    setIsUploading(true)
    e.target.value = ''
    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await apiFetch<{ url: string; fileName: string; fileSize: number; mimeType?: string }>(
        '/api/upload', { method: 'POST', body: formData }
      )

      const finalIsImage = isImage || file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')
      const isAudio = file.type.startsWith('audio/')

      const msgType = finalIsImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'file'
      const msgContent = finalIsImage ? '📷 Photo' : isVideo ? '🎥 Video' : isAudio ? `🎵 ${file.name}` : `📎 ${file.name}`

      // Try to extract video duration from the file metadata
      let videoDuration: number | undefined
      if (isVideo) {
        videoDuration = await new Promise<number | undefined>((resolve) => {
          const video = document.createElement('video')
          video.preload = 'metadata'
          video.onloadedmetadata = () => {
            resolve(video.duration || undefined)
          }
          video.onerror = () => resolve(undefined)
          video.src = URL.createObjectURL(file)
        })
      }

      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const tempMessage: ChatMessage = {
        id: tempId,
        chatId: isGroup ? null : activeId,
        groupId: isGroup ? activeId : null,
        content: msgContent,
        type: msgType as any,
        fileUrl: uploadRes.url,
        fileName: uploadRes.fileName,
        fileSize: uploadRes.fileSize,
        videoDuration,
        senderId: currentUser.id,
        receiverId: isGroup ? null : otherUser?.id,
        read: false,
        createdAt: new Date().toISOString(),
        sender: {
          id: currentUser.id, username: currentUser.username,
          displayName: currentUser.displayName, avatarColor: currentUser.avatarColor,
        },
        pending: true,
        silent: silentSend,
        isSpoiler: spoilerSend,
        replyToId: replyTo?.id,
      }
      addMessage(activeId, tempMessage)

      const commonFields = {
        content: msgContent,
        type: msgType,
        fileUrl: uploadRes.url,
        fileName: uploadRes.fileName,
        fileSize: uploadRes.fileSize,
        videoDuration,
        replyToId: replyTo?.id,
        silent: silentSend,
        isSpoiler: spoilerSend,
        tempId,
      }
      const body = isGroup && group
        ? { groupId: activeId, ...commonFields }
        : { chatId: activeId, receiverId: otherUser!.id, ...commonFields }

      const data = await apiFetch<{ message: ChatMessage; memberIds?: string[] }>(
        '/api/messages', { method: 'POST', body: JSON.stringify(body) }
      )
      updateMessage(activeId, tempId, data.message)

      if (isGroup && data.memberIds?.length) {
        const socket = (window as any).__zapchat_socket
        if (socket) {
          socket.emit('group:message:send', {
            messageId: data.message.id, groupId: activeId,
            senderId: currentUser.id, memberIds: data.memberIds, payload: data.message,
          })
        }
      }
      setReplyTo(null)
      setSpoilerSend(false)
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Reuse the file select handler with isImage=false; it auto-detects video type
    await handleFileSelect(e, false)
  }

  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Reuse the file select handler with isImage=false; it auto-detects audio type
    await handleFileSelect(e, false)
  }

  const handleVoiceSend = async (audioData: {
    fileUrl: string; fileName: string; fileSize: number; duration: number; waveform: number[]
  }) => {
    if (!activeId || !currentUser || !activeConversation) return
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const tempMessage: ChatMessage = {
      id: tempId,
      chatId: isGroup ? null : activeId,
      groupId: isGroup ? activeId : null,
      content: '🎤 Voice message',
      type: 'voice',
      fileUrl: audioData.fileUrl,
      fileName: audioData.fileName,
      fileSize: audioData.fileSize,
      audioDuration: audioData.duration,
      audioWaveform: JSON.stringify(audioData.waveform),
      senderId: currentUser.id,
      receiverId: isGroup ? null : otherUser?.id,
      read: false,
      createdAt: new Date().toISOString(),
      sender: {
        id: currentUser.id, username: currentUser.username,
        displayName: currentUser.displayName, avatarColor: currentUser.avatarColor,
      },
      pending: true,
      silent: silentSend,
      replyToId: replyTo?.id,
    }
    addMessage(activeId, tempMessage)

    const body = isGroup && group
      ? { groupId: activeId, content: tempMessage.content, type: 'voice',
          fileUrl: audioData.fileUrl, fileName: audioData.fileName, fileSize: audioData.fileSize,
          audioDuration: audioData.duration, audioWaveform: JSON.stringify(audioData.waveform),
          replyToId: replyTo?.id, silent: silentSend, tempId }
      : { chatId: activeId, receiverId: otherUser!.id, content: tempMessage.content, type: 'voice',
          fileUrl: audioData.fileUrl, fileName: audioData.fileName, fileSize: audioData.fileSize,
          audioDuration: audioData.duration, audioWaveform: JSON.stringify(audioData.waveform),
          replyToId: replyTo?.id, silent: silentSend, tempId }

    try {
      const data = await apiFetch<{ message: ChatMessage; memberIds?: string[] }>(
        '/api/messages', { method: 'POST', body: JSON.stringify(body) }
      )
      updateMessage(activeId, tempId, data.message)
      if (isGroup && data.memberIds?.length) {
        const socket = (window as any).__zapchat_socket
        if (socket) {
          socket.emit('group:message:send', {
            messageId: data.message.id, groupId: activeId,
            senderId: currentUser.id, memberIds: data.memberIds, payload: data.message,
          })
        }
      }
      setReplyTo(null)
    } catch (e: any) {
      toast.error(e.message || 'Failed to send voice message')
    }
  }

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser) return
    try {
      const data = await apiFetch<{ action: 'added' | 'removed'; emoji: string }>(
        '/api/reactions',
        { method: 'POST', body: JSON.stringify({ messageId, emoji }) }
      )
      toggleReactionLocal(messageId, emoji, currentUser.id, data.action)

      // Broadcast via WS
      const socket = (window as any).__zapchat_socket
      if (socket) {
        // Determine recipientIds
        const msg = messages.find((m) => m.id === messageId)
        const recipientIds: string[] = []
        if (msg?.receiverId) recipientIds.push(msg.receiverId)
        if (msg?.groupId) {
          const g = useChatStore.getState().groups.find((x) => x.id === msg.groupId)
          if (g) {
            g.members.forEach((m) => {
              if (m.user.id !== currentUser.id) recipientIds.push(m.user.id)
            })
          }
        }
        socket.emit('reaction:toggle', {
          messageId, emoji, userId: currentUser.id,
          chatId: msg?.chatId, groupId: msg?.groupId, channelId: msg?.channelId,
          receiverIds: recipientIds, action: data.action,
        })
      }
    } catch (e: any) {
      toast.error(e.message || 'Reaction failed')
    }
  }

  const handleEditMessage = (msg: ChatMessage) => {
    setEditingMessage(msg)
    setInput(msg.content)
  }

  const handlePinMessage = async (msg: ChatMessage) => {
    if (!activeId) return
    try {
      const body = isGroup
        ? { id: msg.id, groupId: activeId }
        : { id: msg.id, chatId: activeId }
      await apiFetch('/api/messages?action=pin', { method: 'PATCH', body: JSON.stringify(body) })
      setPinnedMessage(activeId, msg)
      toast.success('Message pinned')

      const socket = (window as any).__zapchat_socket
      if (socket) {
        const recipientIds: string[] = []
        if (msg.receiverId) recipientIds.push(msg.receiverId)
        if (msg.groupId) {
          const g = useChatStore.getState().groups.find((x) => x.id === msg.groupId)
          if (g) g.members.forEach((m) => {
            if (m.user.id !== currentUser?.id) recipientIds.push(m.user.id)
          })
        }
        socket.emit('message:pinned', {
          chatId: msg.chatId, groupId: msg.groupId,
          messageId: msg.id, recipientIds,
        })
      }
    } catch (e: any) {
      toast.error(e.message || 'Pin failed')
    }
  }

  const handleUnpinMessage = async () => {
    if (!activeId) return
    try {
      const body = isGroup ? { groupId: activeId } : { chatId: activeId }
      await apiFetch('/api/messages?action=unpin', { method: 'PATCH', body: JSON.stringify(body) })
      setPinnedMessage(activeId, null)
      toast.success('Message unpinned')

      const socket = (window as any).__zapchat_socket
      if (socket) {
        const recipientIds: string[] = []
        if (otherUser) recipientIds.push(otherUser.id)
        if (group) group.members.forEach((m) => {
          if (m.user.id !== currentUser?.id) recipientIds.push(m.user.id)
        })
        socket.emit('message:unpinned', {
          chatId: !isGroup ? activeId : undefined,
          groupId: isGroup ? activeId : undefined,
          recipientIds,
        })
      }
    } catch (e: any) {
      toast.error(e.message || 'Unpin failed')
    }
  }

  const handleDeleteForBoth = async (msg: ChatMessage) => {
    if (!confirm('Delete this message for everyone? This cannot be undone.')) return
    try {
      const data = await apiFetch<{ recipientIds: string[]; messageId: string }>(
        `/api/messages?id=${msg.id}&action=both`,
        { method: 'DELETE' }
      )
      removeMessage(activeId!, msg.id)
      toast.success('Message deleted')

      const socket = (window as any).__zapchat_socket
      if (socket && data.recipientIds?.length) {
        socket.emit('message:deleted', {
          messageId: msg.id,
          chatId: msg.chatId, groupId: msg.groupId, channelId: msg.channelId,
          recipientIds: data.recipientIds,
        })
      }
    } catch (e: any) {
      toast.error(e.message || 'Delete failed')
    }
  }

  const handleStartCall = async (callType: 'audio' | 'video') => {
    if (!otherUser || !currentUser) return
    try {
      const data = await apiFetch<{ callId: string }>(`/api/calls?action=initiate`, {
        method: 'POST',
        body: JSON.stringify({ receiverId: otherUser.id, callType }),
      })
      const socket = (window as any).__zapchat_socket
      if (socket) {
        socket.emit('call:invite', {
          callId: data.callId,
          callerId: currentUser.id,
          callerName: currentUser.displayName,
          callerAvatarColor: currentUser.avatarColor,
          receiverId: otherUser.id,
          callType,
        })
      }
      setCall({
        callId: data.callId,
        otherUserId: otherUser.id,
        otherUserName: otherUser.displayName,
        otherUserAvatarColor: otherUser.avatarColor,
        callType,
        direction: 'outgoing',
        status: 'ringing',
        isMuted: false,
        isVideoOff: false,
      })
    } catch (e: any) {
      toast.error(e.message || 'Call failed')
    }
  }

  // Empty state
  if (!activeConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background chat-pattern-bg">
        <div className="text-center max-w-md p-6">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-accent/30 text-primary mb-4">
            <Send className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold mb-2">Welcome to ZapChat</h2>
          <p className="text-sm text-muted-foreground">
            Select a conversation, start a new chat, group, or channel.
          </p>
        </div>
      </div>
    )
  }

  // Header content
  const headerContent = isGroup && group ? (
    <>
      <Avatar name={group.name} color={group.avatarColor} size="md" />
      <div className="min-w-0">
        <p className="font-semibold truncate">{group.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {isTyping ? (
            <span className="text-primary">
              {typeof isTyping === 'object' && isTyping ? `${(isTyping as any).username} is typing...` : 'typing...'}
            </span>
          ) : group.slowModeSecs ? (
            <span>Slow mode: {group.slowModeSecs}s · {group.members.length} members</span>
          ) : (
            <span>{group.members.length} members</span>
          )}
        </p>
      </div>
    </>
  ) : otherUser ? (
    <>
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
            <span className="text-primary">typing...</span>
          ) : isOnline ? (
            <span className="text-green-500">online</span>
          ) : (
            `last seen ${formatTimeFull(otherUser.lastSeen)}`
          )}
        </p>
      </div>
    </>
  ) : null

  const headerClick = () => {
    if (isGroup && group) onOpenGroupInfo(group.id)
    else if (otherUser) onOpenUserProfile(otherUser.id)
  }

  const pinned = activeId ? pinnedMessages[activeId] : null

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="h-16 px-3 sm:px-4 border-b border-border flex items-center gap-3 bg-card/80 backdrop-blur-md shrink-0">
        <Button variant="ghost" size="icon" className="md:hidden -ml-1" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <button onClick={headerClick} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-90 transition-opacity text-left">
          {isGroup && group ? (
            <div
              className="relative h-10 w-10 rounded-full flex items-center justify-center text-white ring-2 ring-background shrink-0"
              style={{ background: group.avatarColor }}
            >
              <Users className="h-5 w-5" />
            </div>
          ) : null}
          {headerContent}
        </button>

        <div className="flex items-center gap-1">
          {!isGroup && otherUser && (
            <>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => handleStartCall('audio')} title="Voice call">
                <Phone className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => handleStartCall('video')} title="Video call">
                <Video className="h-5 w-5" />
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={headerClick}>
                {isGroup ? 'Group info' : 'View profile'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                if (isGroup && group) onOpenGroupSettings(group.id)
                else if (!isGroup && activeId) onOpenChatSettings(activeId)
              }}>
                <Settings className="h-4 w-4 mr-2" />
                {isGroup ? 'Group settings' : 'Chat settings'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                if (isGroup && group) onOpenChatSettings(undefined, group.id)
                else if (!isGroup && activeId) onOpenChatSettings(activeId)
              }}>
                <Bell className="h-4 w-4 mr-2" />
                Notifications & archive
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => toast.info('Clear chat — coming soon')}>
                Clear chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Pinned message bar */}
      {pinned && (
        <div className="px-3 py-2 border-b border-border bg-primary/5 flex items-center gap-2">
          <Pin className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pinned</p>
            <p className="text-xs truncate">{pinned.content}</p>
          </div>
          <button onClick={handleUnpinMessage} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-hidden chat-pattern-bg relative">
        <ScrollArea ref={scrollRef as any} className="h-full scrollbar-thin">
          <div className="min-h-full flex flex-col justify-end p-3 sm:p-4">
            <div className="space-y-1 max-w-3xl mx-auto w-full">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">
                    {isGroup && group
                      ? `👋 Be the first to say hi in "${group.name}"!`
                      : `👋 Say hello to ${otherUser?.displayName}!`}
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isOwn = msg.senderId === currentUser?.id
                  const prevMsg = messages[idx - 1]
                  const nextMsg = messages[idx + 1]
                  const showAvatar = !isOwn && (!prevMsg || prevMsg.senderId !== msg.senderId)
                  const showSenderName = isGroup && !isOwn && (!prevMsg || prevMsg.senderId !== msg.senderId)
                  const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId
                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={isOwn}
                      showAvatar={showAvatar}
                      showSenderName={showSenderName}
                      isLastInGroup={isLastInGroup}
                      otherUser={otherUser}
                      isGroup={!!isGroup}
                      currentUser={currentUser}
                      reactions={reactionsByMessage[msg.id] || []}
                      onToggleReaction={(emoji) => handleToggleReaction(msg.id, emoji)}
                      onReply={() => setReplyTo(msg)}
                      onEdit={() => handleEditMessage(msg)}
                      onPin={() => handlePinMessage(msg)}
                      onDelete={() => handleDeleteForBoth(msg)}
                      onForward={() => {
                        useExtendedStore.getState().setForwardSourceMessageId(msg.id)
                        useExtendedStore.getState().setShowForwardModal(true)
                      }}
                      onCopyMedia={() => {
                        if (msg.fileUrl) {
                          navigator.clipboard?.writeText(window.location.origin + msg.fileUrl)
                          toast.success('Media link copied')
                        }
                      }}
                      replyToMessage={messages.find((m) => m.id === msg.replyToId)}
                    />
                  )
                })
              )}
              {isTyping && (
                <div className="flex items-end gap-2 max-w-[70%]">
                  {otherUser && (
                    <Avatar name={otherUser.displayName} color={otherUser.avatarColor} size="sm" />
                  )}
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

      {/* Reply preview */}
      {replyTo && (
        <div className="px-3 py-2 border-t border-border bg-muted/30 flex items-center gap-2">
          <Reply className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-primary uppercase tracking-wide">Replying to</p>
            <p className="text-xs truncate">{replyTo.content}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Edit preview */}
      {editingMessage && (
        <div className="px-3 py-2 border-t border-border bg-amber-500/10 flex items-center gap-2">
          <Edit2 className="h-4 w-4 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-amber-600 uppercase tracking-wide">Editing</p>
            <p className="text-xs truncate">{editingMessage.content}</p>
          </div>
          <button onClick={() => setEditingMessage(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
          <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFileSelect(e, false)} />
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, true)} />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleVideoSelect(e)}
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => handleAudioSelect(e)}
          />

          {/* Attach menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full shrink-0" disabled={isUploading}>
                {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start">
              <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                <ImageIcon className="h-4 w-4 mr-2" />
                Photo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => videoInputRef.current?.click()}>
                <Film className="h-4 w-4 mr-2" />
                Video
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => audioInputRef.current?.click()}>
                <Music className="h-4 w-4 mr-2" />
                Audio file
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <FileIcon className="h-4 w-4 mr-2" />
                Any file
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Spoiler toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={`rounded-full shrink-0 ${spoilerSend ? 'text-purple-500 bg-purple-500/10' : ''}`}
            onClick={() => setSpoilerSend(!spoilerSend)}
            title={spoilerSend ? 'Spoiler on' : 'Spoiler off'}
          >
            <EyeOff className="h-5 w-5" />
          </Button>

          {/* Voice recorder (shown when input empty) */}
          {!input.trim() && (
            <VoiceRecorder onSend={handleVoiceSend} />
          )}

          <Button variant="ghost" size="icon" className="rounded-full shrink-0" onClick={() => setShowEmoji((s) => !s)}>
            <Smile className="h-5 w-5" />
          </Button>

          {/* Silent toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={`rounded-full shrink-0 ${silentSend ? 'text-primary bg-primary/10' : ''}`}
            onClick={() => setSilentSend(!silentSend)}
            title={silentSend ? 'Silent send on' : 'Silent send off'}
          >
            {silentSend ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          </Button>

          <Input
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={editingMessage ? 'Edit message...' : isGroup ? `Message ${group?.name || 'group'}` : 'Type a message...'}
            className="flex-1 h-11 bg-background border-border"
            disabled={isUploading}
          />

          <Button
            onClick={handleSend}
            disabled={!input.trim() || isUploading}
            className="h-11 w-11 rounded-full p-0 shrink-0 shadow-lg shadow-primary/30"
            title={editingMessage ? 'Save edit' : 'Send'}
          >
            {editingMessage ? <Check className="h-5 w-5" /> : <Send className="h-5 w-5" />}
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
  message, isOwn, showAvatar, showSenderName, isLastInGroup,
  otherUser, isGroup, currentUser, reactions, onToggleReaction,
  onReply, onEdit, onPin, onDelete, onForward, onCopyMedia, replyToMessage,
}: {
  message: ChatMessage
  isOwn: boolean
  showAvatar: boolean
  showSenderName: boolean
  isLastInGroup: boolean
  otherUser: any
  isGroup: boolean
  currentUser: any
  reactions: Reaction[]
  onToggleReaction: (emoji: string) => void
  onReply: () => void
  onEdit: () => void
  onPin: () => void
  onDelete: () => void
  onForward: () => void
  onCopyMedia: () => void
  replyToMessage?: ChatMessage
}) {
  const [imageOpen, setImageOpen] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [bubbleRef, setBubbleRef] = useState<DOMRect | null>(null)
  const [spoilerRevealed, setSpoilerRevealed] = useState(false)
  const senderName = message.sender?.displayName || (message.isAnonymous ? 'Anonymous' : 'Unknown')
  const senderColor = message.sender?.avatarColor || '#6366f1'

  return (
    <div className={`flex items-end gap-2 group ${isOwn ? 'justify-end' : 'justify-start'}`}>
      {!isOwn && (
        <div className="w-8 shrink-0">
          {showAvatar && !message.isAnonymous && (
            <Avatar name={senderName} color={senderColor} size="sm" />
          )}
        </div>
      )}

      <div className={`max-w-[80%] sm:max-w-[70%] relative flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        {showSenderName && !isOwn && !message.isAnonymous && (
          <span className="text-xs font-medium mb-0.5 ml-1" style={{ color: senderColor }}>
            {senderName}
          </span>
        )}

        {/* Forwarded banner */}
        {message.forwardedFromName && (
          <div className={`mb-1 flex items-center gap-1 text-[10px] opacity-70 px-1 ${isOwn ? 'justify-end' : ''}`}>
            <Forward className="h-3 w-3" />
            <span>Forwarded from <strong>{message.forwardedFromName}</strong></span>
          </div>
        )}

        {/* Reply preview */}
        {replyToMessage && (
          <div
            className={`mb-1 px-3 py-1.5 rounded-lg border-l-2 text-xs max-w-full ${
              isOwn ? 'bg-primary-foreground/10 border-primary-foreground/50' : 'bg-muted border-primary'
            }`}
          >
            <p className="font-semibold text-[10px] opacity-70">
              {replyToMessage.senderId === currentUser?.id
                ? 'You'
                : replyToMessage.sender?.displayName || 'Unknown'}
            </p>
            <p className="truncate opacity-80">{replyToMessage.content}</p>
          </div>
        )}

        <DropdownMenu>
          {/* The message bubble itself - NOT a dropdown trigger */}
          <div
            ref={(el) => { /* store for picker positioning */ }}
            className={cn(
              'px-3 py-2 rounded-2xl cursor-pointer relative transition-all animate-message-in group/msg',
              isOwn
                ? 'bg-primary text-primary-foreground ' + (isLastInGroup ? 'rounded-br-sm' : '')
                : 'bg-card border border-border ' + (isLastInGroup ? 'rounded-bl-sm' : ''),
              message.pending && 'opacity-70'
            )}
            onClick={(e) => {
              // Double-click for quick reaction
              if (e.detail === 2) {
                onToggleReaction('❤️')
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              const target = e.currentTarget
              setBubbleRef(target.getBoundingClientRect())
              setShowReactionPicker(true)
            }}
          >
            {/* Silent indicator */}
            {message.silent && (
              <span className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-0.5" title="Silent message">
                <BellOff className="h-3 w-3 text-muted-foreground" />
              </span>
            )}

            {/* 3-dots button - opens dropdown menu (only on hover) */}
            <DropdownMenuTrigger asChild>
              <button
                className="absolute top-1 right-1 opacity-0 group-hover/msg:opacity-100 transition-opacity bg-black/40 hover:bg-black/60 text-white rounded-md p-1 z-10"
                title="More options"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>

            {message.type === 'image' && message.fileUrl ? (
              <div className="space-y-1">
                {message.isSpoiler && !spoilerRevealed ? (
                  <SpoilerOverlay onReveal={() => setSpoilerRevealed(true)} type="image" />
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setImageOpen(true) }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="block relative group/img"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={message.fileUrl} alt={message.fileName || 'image'} className="rounded-lg max-h-64 max-w-full object-cover" />
                    <div className="absolute top-1 right-1 opacity-0 group-hover/img:opacity-100 transition-opacity flex gap-1">
                      <a
                        href={message.fileUrl}
                        download={message.fileName || 'image'}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="bg-black/60 backdrop-blur text-white rounded-md p-1.5 hover:bg-black/80"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </button>
                )}
                {message.content && message.content !== '📷 Photo' && (
                  <MarkdownRenderer content={message.content} className="text-sm" />
                )}
              </div>
            ) : message.type === 'video' && message.fileUrl ? (
              <div className="space-y-1" onPointerDown={(e) => e.stopPropagation()}>
                {message.isSpoiler && !spoilerRevealed ? (
                  <SpoilerOverlay onReveal={() => setSpoilerRevealed(true)} type="video" />
                ) : (
                  <VideoPlayer
                    src={message.fileUrl}
                    thumbnail={message.videoThumbnail}
                    duration={message.videoDuration}
                    fileName={message.fileName}
                    fileSize={message.fileSize}
                    senderColor={senderColor}
                    isOwn={isOwn}
                    isSpoiler={false}
                  />
                )}
                {message.content && message.content !== '🎥 Video' && (
                  <MarkdownRenderer content={message.content} className="text-sm" />
                )}
              </div>
            ) : message.type === 'voice' ? (
              <div className="min-w-[240px]" onPointerDown={(e) => e.stopPropagation()}>
                {message.isSpoiler && !spoilerRevealed ? (
                  <SpoilerOverlay onReveal={() => setSpoilerRevealed(true)} type="voice" />
                ) : (
                  <AudioPlayer
                    src={message.fileUrl!}
                    duration={message.audioDuration}
                    waveform={message.audioWaveform}
                    senderColor={senderColor}
                    isOwn={isOwn}
                  />
                )}
              </div>
            ) : message.type === 'audio' && message.fileUrl ? (
              <div className="min-w-[240px]" onPointerDown={(e) => e.stopPropagation()}>
                <audio controls src={message.fileUrl} className="w-full" />
                {message.fileName && (
                  <p className="text-xs opacity-70 mt-1 truncate">🎵 {message.fileName}</p>
                )}
              </div>
            ) : message.type === 'gif' && message.gifUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={message.gifUrl} alt={message.gifId || 'gif'} className="rounded-lg max-h-64 max-w-full" />
            ) : message.type === 'file' && message.fileUrl ? (
              <a
                href={message.fileUrl}
                download={message.fileName || 'file'}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex items-center gap-3 py-1 min-w-[200px]"
              >
                <div className="h-10 w-10 rounded-lg bg-background/20 flex items-center justify-center shrink-0">
                  <FileIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{message.fileName}</p>
                  {message.fileSize && <p className="text-xs opacity-70">{formatBytes(message.fileSize)}</p>}
                </div>
              </a>
            ) : message.isSpoiler && !spoilerRevealed ? (
              <SpoilerOverlay onReveal={() => setSpoilerRevealed(true)} type="text" />
            ) : (
              <MarkdownRenderer content={message.content} className="text-sm" />
            )}

            {/* Metadata footer */}
            <div className={cn(
              'flex items-center gap-1 mt-1 text-[10px]',
              isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}>
              {message.pending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  {message.editedAt && <span className="italic">edited</span>}
                  <span>{formatTimeFull(message.createdAt)}</span>
                  {isOwn && (
                    message.read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />
                  )}
                </>
              )}
            </div>
          </div>
          <DropdownMenuContent align={isOwn ? 'end' : 'start'}>
            <DropdownMenuItem onClick={() => onToggleReaction('❤️')}>
              <span className="mr-2">❤️</span> React
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onReply}>
              <Reply className="h-4 w-4 mr-2" />
              Reply
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onForward}>
              <Forward className="h-4 w-4 mr-2" />
              Forward
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onPin}>
              <Pin className="h-4 w-4 mr-2" />
              Pin
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigator.clipboard?.writeText(message.content)}>
              <Copy className="h-4 w-4 mr-2" />
              Copy text
            </DropdownMenuItem>
            {message.fileUrl && (
              <DropdownMenuItem onClick={onCopyMedia}>
                <Copy className="h-4 w-4 mr-2" />
                Copy media link
              </DropdownMenuItem>
            )}
            {isOwn && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onEdit}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete for everyone
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onToggleReaction(r.emoji)}
                className={cn(
                  'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] border transition-all',
                  r.mine
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border hover:bg-accent'
                )}
                title={r.users.map((u) => u.displayName).join(', ')}
              >
                <span>{r.emoji}</span>
                <span className="font-medium">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Reaction picker */}
        <ReactionPicker
          open={showReactionPicker}
          onClose={() => setShowReactionPicker(false)}
          onSelect={onToggleReaction}
          anchorRect={bubbleRef}
        />
      </div>

      {/* Image viewer (with zoom, download, fullscreen) */}
      <ImageViewer
        src={message.fileUrl || ''}
        fileName={message.fileName}
        isOpen={imageOpen}
        onClose={() => setImageOpen(false)}
      />
    </div>
  )
}

// ============================================================
// SpoilerOverlay - hides content until clicked
// ============================================================
function SpoilerOverlay({ onReveal, type }: { onReveal: () => void; type: 'text' | 'image' | 'video' | 'voice' }) {
  const icons = {
    text: '📝',
    image: '📷',
    video: '🎥',
    voice: '🎤',
  }
  const labels = {
    text: 'Hidden message',
    image: 'Hidden photo',
    video: 'Hidden video',
    voice: 'Hidden voice message',
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onReveal() }}
      className="relative w-full min-h-[80px] rounded-lg overflow-hidden bg-gradient-to-br from-purple-900/60 to-pink-900/60 backdrop-blur-md flex flex-col items-center justify-center group hover:scale-[1.02] transition-transform p-4"
    >
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0 2px, transparent 2px 8px)'
      }} />
      <div className="relative z-10 text-center">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 mb-2 group-hover:scale-110 transition-transform">
          <span className="text-lg">{icons[type]}</span>
        </div>
        <p className="text-white text-xs font-medium">{labels[type]}</p>
        <p className="text-white/60 text-[10px] mt-0.5">Click to reveal</p>
      </div>
    </button>
  )
}
