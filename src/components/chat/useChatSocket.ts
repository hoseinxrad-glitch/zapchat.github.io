'use client'

import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useChatStore } from '@/lib/chat-store'
import { useExtendedStore } from '@/lib/extended-store'
import { apiFetch, type AuthUser } from '@/lib/chat-utils'
import type { ChatMessage } from '@/lib/chat-store'

/**
 * useChatSocket - sets up the Socket.io connection, handles auth bootstrap,
 * listens for incoming direct + group messages, typing, presence, and group events.
 */
export function useChatSocket() {
  const socketRef = useRef<Socket | null>(null)
  const currentUser = useChatStore((s) => s.currentUser)
  const setCurrentUser = useChatStore((s) => s.setCurrentUser)
  const setAuthLoading = useChatStore((s) => s.setAuthLoading)
  const isAuthLoading = useChatStore((s) => s.isAuthLoading)

  const setChats = useChatStore((s) => s.setChats)
  const setGroups = useChatStore((s) => s.setGroups)
  const upsertChat = useChatStore((s) => s.upsertChat)
  const upsertGroup = useChatStore((s) => s.upsertGroup)
  const removeGroup = useChatStore((s) => s.removeGroup)
  const setMessages = useChatStore((s) => s.setMessages)
  const addMessage = useChatStore((s) => s.addMessage)
  const markChatRead = useChatStore((s) => s.markChatRead)

  const setOnlineUsers = useChatStore((s) => s.setOnlineUsers)
  const setUserOnline = useChatStore((s) => s.setUserOnline)
  const setUserOffline = useChatStore((s) => s.setUserOffline)
  const setTyping = useChatStore((s) => s.setTyping)
  const setGroupTyping = useChatStore((s) => s.setGroupTyping)
  const setSocketConnected = useChatStore((s) => s.setSocketConnected)

  // Track chats and groups to update last message
  const chatsRef = useRef(useChatStore.getState().chats)
  const groupsRef = useRef(useChatStore.getState().groups)
  useEffect(() => {
    const unsub = useChatStore.subscribe((s) => {
      chatsRef.current = s.chats
      groupsRef.current = s.groups
    })
    return unsub
  }, [])

  // 1) Bootstrap: load direct chats + groups from API on mount if authenticated
  useEffect(() => {
    if (!currentUser) return

    // Load direct chats
    apiFetch<{ chats: any[] }>('/api/chats?action=list')
      .then((data) => {
        const directChats = data.chats.map((c) => ({
          id: c.id,
          isGroup: false,
          otherUser: c.otherUser,
          lastMessage: c.lastMessage,
          unreadCount: c.unreadCount,
          updatedAt: c.updatedAt,
        }))
        // Load groups
        return apiFetch<{ groups: any[] }>('/api/groups?action=list').then((groupData) => {
          const groupChats = groupData.groups.map((g) => ({
            id: g.id,
            isGroup: true,
            group: {
              id: g.id,
              name: g.name,
              description: g.description,
              avatarColor: g.avatarColor,
              creatorId: g.creatorId,
              memberCount: g.members?.length || 0,
            },
            lastMessage: g.lastMessage,
            unreadCount: g.unreadCount,
            updatedAt: g.updatedAt,
          }))
          // Merge and sort by updatedAt
          const all = [...directChats, ...groupChats].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )
          setChats(all)
          setGroups(groupData.groups)
        })
      })
      .catch((e) => console.error('[load chats]', e))
  }, [currentUser?.id, setChats, setGroups])

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
    ;(window as any).__zapchat_socket = socket

    socket.on('connect', () => {
      setSocketConnected(true)
      socket.emit('user:online', {
        userId: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.displayName,
        avatarColor: currentUser.avatarColor,
      })
    })

    socket.on('disconnect', () => setSocketConnected(false))
    socket.on('reconnect', () => setSocketConnected(true))

    // -------- Direct message received --------
    socket.on('message:receive', (data: any) => {
      const incoming: ChatMessage = data
      const existing = chatsRef.current.find((c) => c.id === incoming.chatId)
      if (!existing) {
        apiFetch<{ chats: any[] }>('/api/chats?action=list')
          .then((d) => {
            const directChats = d.chats.map((c) => ({
              id: c.id, isGroup: false, otherUser: c.otherUser,
              lastMessage: c.lastMessage, unreadCount: c.unreadCount, updatedAt: c.updatedAt,
            }))
            // Merge with existing groups in chatsRef
            const groupChats = chatsRef.current.filter((c) => c.isGroup)
            const all = [...directChats, ...groupChats].sort(
              (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            )
            setChats(all)
          })
          .catch(() => {})
      } else {
        upsertChat({
          id: incoming.chatId!,
          isGroup: false,
          otherUser: existing.otherUser,
          lastMessage: incoming,
          unreadCount:
            incoming.receiverId === currentUser.id
              ? useChatStore.getState().activeConversation?.type === 'direct' &&
                useChatStore.getState().activeConversation.chatId === incoming.chatId
                ? 0
                : existing.unreadCount + 1
              : existing.unreadCount,
          updatedAt: new Date().toISOString(),
        })
      }
      addMessage(incoming.chatId!, incoming)

      const active = useChatStore.getState().activeConversation
      if (active?.type === 'direct' && active.chatId === incoming.chatId) {
        markChatRead(incoming.chatId!)
        apiFetch('/api/chats?action=read', {
          method: 'PATCH',
          body: JSON.stringify({ chatId: incoming.chatId, messageIds: [incoming.id] }),
        }).catch(() => {})
      }
    })

    // Read receipt
    socket.on('message:read-receipt', (data: { chatId: string; messageIds: string[] }) => {
      const messages = useChatStore.getState().messagesByConversation[data.chatId] || []
      const updated = messages.map((m) =>
        data.messageIds.includes(m.id) ? { ...m, read: true } : m
      )
      setMessages(data.chatId, updated)
    })

    // -------- Direct typing --------
    socket.on('typing', (data: { fromUserId: string; isTyping: boolean }) => {
      setTyping(data.fromUserId, data.isTyping)
      if (data.isTyping) {
        setTimeout(() => {
          const current = useChatStore.getState().typingByUserId[data.fromUserId]
          if (current) setTyping(data.fromUserId, false)
        }, 4000)
      }
    })

    // -------- Group message received --------
    socket.on('group:message:receive', (data: { groupId: string; message: ChatMessage }) => {
      const { groupId, message } = data
      const existing = chatsRef.current.find((c) => c.id === groupId)
      if (existing) {
        upsertChat({
          id: groupId,
          isGroup: true,
          group: existing.group,
          lastMessage: message,
          unreadCount:
            useChatStore.getState().activeConversation?.type === 'group' &&
            useChatStore.getState().activeConversation.groupId === groupId
              ? 0
              : existing.unreadCount + 1,
          updatedAt: new Date().toISOString(),
        })
      }
      addMessage(groupId, message)

      const active = useChatStore.getState().activeConversation
      if (active?.type === 'group' && active.groupId === groupId) {
        markChatRead(groupId)
      }
    })

    // -------- Group typing --------
    socket.on('group:typing', (data: {
      groupId: string
      fromUserId: string
      fromUsername: string
      isTyping: boolean
    }) => {
      setGroupTyping(
        data.groupId,
        data.isTyping ? { userId: data.fromUserId, username: data.fromUsername } : null
      )
      if (data.isTyping) {
        setTimeout(() => {
          const current = useChatStore.getState().typingByGroup[data.groupId]
          if (current?.userId === data.fromUserId) {
            setGroupTyping(data.groupId, null)
          }
        }, 4000)
      }
    })

    // -------- New group received (someone added me) --------
    socket.on('group:new-received', (data: { group: any }) => {
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
          memberCount: data.group.members?.length || 0,
        },
        lastMessage: null,
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
      })
    })

    // -------- Group events --------
    socket.on('group:event', (data: {
      type: 'member-added' | 'member-removed' | 'group-updated' | 'group-deleted'
      groupId: string
      payload?: any
    }) => {
      if (data.type === 'group-deleted') {
        removeGroup(data.groupId)
        return
      }
      // For member-added / member-removed / group-updated, refresh the group info
      apiFetch<{ group: any }>(`/api/groups/${data.groupId}`)
        .then((res) => {
          upsertGroup(res.group)
          // Update the chat row in sidebar
          const existing = chatsRef.current.find((c) => c.id === data.groupId)
          if (existing) {
            upsertChat({
              ...existing,
              group: {
                id: res.group.id,
                name: res.group.name,
                description: res.group.description,
                avatarColor: res.group.avatarColor,
                creatorId: res.group.creatorId,
                memberCount: res.group.members.length,
              },
            })
          }
        })
        .catch(() => {})
    })

    // -------- Presence --------
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

    // -------- New chat (direct) received --------
    socket.on('chat:new-received', () => {
      apiFetch<{ chats: any[] }>('/api/chats?action=list')
        .then((d) => {
          const directChats = d.chats.map((c) => ({
            id: c.id, isGroup: false, otherUser: c.otherUser,
            lastMessage: c.lastMessage, unreadCount: c.unreadCount, updatedAt: c.updatedAt,
          }))
          const groupChats = chatsRef.current.filter((c) => c.isGroup)
          const all = [...directChats, ...groupChats].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )
          setChats(all)
        })
        .catch(() => {})
    })

    // -------- Reactions (NEW) --------
    socket.on('reaction:updated', (data: {
      messageId: string
      emoji: string
      userId: string
      action: 'added' | 'removed'
      chatId?: string
      groupId?: string
      channelId?: string
    }) => {
      // Update local reactions
      const { toggleReactionLocal } = useExtendedStore.getState()
      toggleReactionLocal(data.messageId, data.emoji, data.userId, data.action)
    })

    // -------- Message edited (NEW) --------
    socket.on('message:edited', (data: { message: ChatMessage }) => {
      const msg = data.message
      // Find the conversation id (chatId or groupId)
      const convId = msg.chatId || msg.groupId || msg.channelId
      if (!convId) return
      const messages = useChatStore.getState().messagesByConversation[convId] || []
      const updated = messages.map((m) => m.id === msg.id ? { ...msg, pending: false } : m)
      useChatStore.getState().setMessages(convId, updated)
      // Update sidebar preview
      const chat = chatsRef.current.find((c) => c.id === convId)
      if (chat && chat.lastMessage?.id === msg.id) {
        useChatStore.getState().upsertChat({ ...chat, lastMessage: msg })
      }
    })

    // -------- Message pinned/unpinned (NEW) --------
    socket.on('message:pinned', (data: {
      chatId?: string
      groupId?: string
      messageId: string
    }) => {
      const convId = data.chatId || data.groupId
      if (!convId) return
      // Reload messages to get the pinned one
      const isGroup = !!data.groupId
      const endpoint = isGroup
        ? `/api/groups/${convId}/messages?limit=200`
        : `/api/chats?action=messages&chatId=${convId}&limit=200`
      apiFetch<{ messages: ChatMessage[] }>(endpoint)
        .then((d) => {
          const pinned = d.messages.find((m) => m.id === data.messageId)
          if (pinned) useExtendedStore.getState().setPinnedMessage(convId, pinned)
        })
        .catch(() => {})
    })

    socket.on('message:unpinned', (data: { chatId?: string, groupId?: string }) => {
      const convId = data.chatId || data.groupId
      if (convId) useExtendedStore.getState().setPinnedMessage(convId, null)
    })

    // -------- Message deleted for both (NEW) --------
    socket.on('message:deleted', (data: {
      messageId: string
      chatId?: string
      groupId?: string
      channelId?: string
    }) => {
      const convId = data.chatId || data.groupId || data.channelId
      if (convId) {
        useChatStore.getState().removeMessage(convId, data.messageId)
      }
    })

    // -------- Channel events (NEW) --------
    socket.on('channel:new-received', (data: { channel: any }) => {
      useExtendedStore.getState().upsertChannel(data.channel)
    })

    socket.on('channel:post-received', (data: { channelId: string, message: ChatMessage }) => {
      // If user is viewing the channel, add the message
      const active = useExtendedStore.getState().activeChannel
      if (active?.id === data.channelId) {
        // Add to messages list (TODO: channel message storage in extended store)
      }
    })

    socket.on('channel:event', (data: any) => {
      // Refresh channels list
      if (data.type === 'deleted') {
        useExtendedStore.getState().removeChannel(data.channelId)
      } else {
        apiFetch<{ channels: any[] }>('/api/channels?action=list')
          .then((d) => useExtendedStore.getState().setChannels(d.channels || []))
          .catch(() => {})
      }
    })

    // -------- Story events (NEW) --------
    socket.on('story:new-received', (data: { story: any }) => {
      // Reload stories feed
      apiFetch<{ groups: any[] }>('/api/stories?action=feed')
        .then((d) => useExtendedStore.getState().setStoryGroups(d.groups || []))
        .catch(() => {})
    })

    socket.on('story:viewed', (data: any) => {
      // Just reload stories feed
      apiFetch<{ groups: any[] }>('/api/stories?action=feed')
        .then((d) => useExtendedStore.getState().setStoryGroups(d.groups || []))
        .catch(() => {})
    })

    // -------- Voice Calls (NEW) --------
    socket.on('call:incoming', (data: any) => {
      useExtendedStore.getState().setCall({
        callId: data.callId,
        otherUserId: data.callerId,
        otherUserName: data.callerName,
        otherUserAvatarColor: data.callerAvatarColor,
        callType: data.callType,
        direction: 'incoming',
        status: 'ringing',
        isMuted: false,
        isVideoOff: false,
      })
    })

    socket.on('call:accepted', (data: any) => {
      useExtendedStore.getState().updateCall({ status: 'connected' })
    })

    socket.on('call:rejected', (data: any) => {
      useExtendedStore.getState().setCall(null)
    })

    socket.on('call:ended', (data: any) => {
      useExtendedStore.getState().setCall(null)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      ;(window as any).__zapchat_socket = null
    }
  }, [currentUser?.id])

  // 3) Bootstrap auth on first mount
  useEffect(() => {
    if (!isAuthLoading) return
    const token = typeof window !== 'undefined' ? localStorage.getItem('zapchat_token') : null
    if (!token) {
      setAuthLoading(false)
      return
    }
    apiFetch<{ user: AuthUser }>('/api/auth?action=me')
      .then((data) => setCurrentUser(data.user))
      .catch(() => {
        localStorage.removeItem('zapchat_token')
        localStorage.removeItem('zapchat_user')
        setAuthLoading(false)
      })
      .finally(() => setAuthLoading(false))
  }, [isAuthLoading, setCurrentUser, setAuthLoading])
}
