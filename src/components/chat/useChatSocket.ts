'use client'

import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useChatStore } from '@/lib/chat-store'
import { apiFetch, type AuthUser } from '@/lib/chat-utils'
import type { ChatMessage } from '@/lib/chat-store'

/**
 * useChatSocket - sets up the Socket.io connection, handles auth bootstrap,
 * listens for incoming messages, typing, presence, and routes them to the
 * Zustand store.
 */
export function useChatSocket() {
  const socketRef = useRef<Socket | null>(null)
  const currentUser = useChatStore((s) => s.currentUser)
  const setCurrentUser = useChatStore((s) => s.setCurrentUser)
  const setAuthLoading = useChatStore((s) => s.setAuthLoading)
  const isAuthLoading = useChatStore((s) => s.isAuthLoading)

  const setChats = useChatStore((s) => s.setChats)
  const upsertChat = useChatStore((s) => s.upsertChat)
  const setMessages = useChatStore((s) => s.setMessages)
  const addMessage = useChatStore((s) => s.addMessage)
  const setActiveChat = useChatStore((s) => s.setActiveChat)
  const markChatRead = useChatStore((s) => s.markChatRead)

  const setOnlineUsers = useChatStore((s) => s.setOnlineUsers)
  const setUserOnline = useChatStore((s) => s.setUserOnline)
  const setUserOffline = useChatStore((s) => s.setUserOffline)
  const setTyping = useChatStore((s) => s.setTyping)
  const setSocketConnected = useChatStore((s) => s.setSocketConnected)
  const chats = useChatStore((s) => s.chats)

  // Track previous chats to know which were newly added
  const chatsRef = useRef(chats)
  useEffect(() => { chatsRef.current = chats }, [chats])

  // 1) Bootstrap: load chats from API on mount if authenticated
  useEffect(() => {
    if (!currentUser) return
    apiFetch<{ chats: any[] }>('/api/chats?action=list')
      .then((data) => setChats(data.chats))
      .catch((e) => console.error('[load chats]', e))
  }, [currentUser?.id, setChats])

  // 2) Set up the WebSocket connection once we know who we are
  useEffect(() => {
    if (!currentUser) return
    if (socketRef.current) return

    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    })
    socketRef.current = socket
    // Expose socket globally so other components (ChatWindow typing indicator) can emit
    ;(window as any).__zapchat_socket = socket

    socket.on('connect', () => {
      setSocketConnected(true)
      // Tell the server we are online
      socket.emit('user:online', {
        userId: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.displayName,
        avatarColor: currentUser.avatarColor,
      })
    })

    socket.on('disconnect', () => setSocketConnected(false))
    socket.on('reconnect', () => setSocketConnected(true))

    // Incoming message
    socket.on('message:receive', async (data: any) => {
      // data: full message object { id, chatId, senderId, receiverId, content, ... }
      const incoming: ChatMessage = data
      // Fetch full chat list to update sidebar preview
      try {
        // Load this chat's messages from server if we haven't yet
        const existing = chatsRef.current.find((c) => c.id === incoming.chatId)
        if (!existing) {
          // New chat - refetch the chat list
          apiFetch<{ chats: any[] }>('/api/chats?action=list')
            .then((data) => setChats(data.chats))
            .catch(() => {})
        } else {
          // Update chat list with new last message + unread count
          upsertChat({
            id: incoming.chatId,
            otherUser: existing.otherUser,
            lastMessage: incoming,
            unreadCount: incoming.receiverId === currentUser.id
              ? existing.unreadCount + (useChatStore.getState().activeChatId === incoming.chatId ? 0 : 1)
              : existing.unreadCount,
            updatedAt: new Date().toISOString(),
          })
        }
        // Add the message to the chat
        addMessage(incoming.chatId, incoming)

        // If this is the active chat, mark as read immediately
        if (useChatStore.getState().activeChatId === incoming.chatId) {
          markChatRead(incoming.chatId)
          apiFetch('/api/chats?action=read', {
            method: 'PATCH',
            body: JSON.stringify({ chatId: incoming.chatId, messageIds: [incoming.id] }),
          }).catch(() => {})
        }
      } catch (e) {
        console.error('[receive]', e)
      }
    })

    // Message delivered to server (ack)
    socket.on('message:delivered', (data: { messageId: string; chatId: string }) => {
      // No-op for now; we wait for the /api/messages POST response
    })

    // Read receipt
    socket.on('message:read-receipt', (data: { chatId: string; messageIds: string[]; readerId: string }) => {
      const messages = useChatStore.getState().messagesByChat[data.chatId] || []
      const updated = messages.map((m) =>
        data.messageIds.includes(m.id) ? { ...m, read: true } : m
      )
      setMessages(data.chatId, updated)
    })

    // Typing indicator
    socket.on('typing', (data: { fromUserId: string; fromUsername: string; isTyping: boolean }) => {
      setTyping(data.fromUserId, data.isTyping)
      if (data.isTyping) {
        // Auto-clear after 4s as a safety net
        setTimeout(() => {
          const current = useChatStore.getState().typingByUserId[data.fromUserId]
          if (current) setTyping(data.fromUserId, false)
        }, 4000)
      }
    })

    // Presence
    socket.on('user:presence', (data: any) => {
      if (data.status === 'online') {
        setUserOnline({
          userId: data.userId,
          username: data.username,
          displayName: data.displayName,
          avatarColor: data.avatarColor,
        })
      } else {
        setUserOffline(data.userId)
      }
    })

    socket.on('users-list', (data: { users: any[] }) => {
      setOnlineUsers(data.users)
    })

    // New chat received from another user
    socket.on('chat:new-received', (data: any) => {
      // Refetch chats
      apiFetch<{ chats: any[] }>('/api/chats?action=list')
        .then((d) => setChats(d.chats))
        .catch(() => {})
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      ;(window as any).__zapchat_socket = null
    }
  }, [currentUser?.id])

  // 3) Bootstrap auth on first mount
  useEffect(() => {
    if (!isAuthLoading) return // already resolved
    const token = typeof window !== 'undefined' ? localStorage.getItem('zapchat_token') : null
    if (!token) {
      setAuthLoading(false)
      return
    }
    apiFetch<{ user: AuthUser }>('/api/auth?action=me')
      .then((data) => setCurrentUser(data.user))
      .catch(() => {
        // Token invalid, clear it
        localStorage.removeItem('zapchat_token')
        localStorage.removeItem('zapchat_user')
        setAuthLoading(false)
      })
      .finally(() => setAuthLoading(false))
  }, [isAuthLoading, setCurrentUser, setAuthLoading])
}
