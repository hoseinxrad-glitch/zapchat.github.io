'use client'

import { create } from 'zustand'
import type { AuthUser } from '@/lib/chat-utils'

// ============================================================
// Types
// ============================================================
export interface ChatUser {
  id: string
  username: string
  displayName: string
  bio: string
  avatarColor: string
  lastSeen: string
}

export interface ChatMessage {
  id: string
  chatId: string
  content: string
  type: 'text' | 'image' | 'file'
  fileUrl?: string | null
  fileName?: string | null
  fileSize?: number | null
  senderId: string
  receiverId: string
  read: boolean
  createdAt: string
  sender?: { id: string; username: string; displayName: string; avatarColor: string }
  pending?: boolean // client-only flag
}

export interface ChatListItem {
  id: string
  otherUser: ChatUser
  lastMessage: ChatMessage | null
  unreadCount: number
  updatedAt: string
}

export interface OnlineUser {
  userId: string
  username: string
  displayName: string
  avatarColor: string
}

interface ChatState {
  // Auth
  currentUser: AuthUser | null
  isAuthLoading: boolean

  setAuthLoading: (v: boolean) => void
  setCurrentUser: (u: AuthUser | null) => void

  // Chats
  chats: ChatListItem[]
  activeChatId: string | null
  activeChatOtherUser: ChatUser | null
  messagesByChat: Record<string, ChatMessage[]>

  setChats: (chats: ChatListItem[]) => void
  upsertChat: (chat: ChatListItem) => void
  setActiveChat: (chatId: string | null, otherUser: ChatUser | null) => void
  setMessages: (chatId: string, messages: ChatMessage[]) => void
  addMessage: (chatId: string, message: ChatMessage) => void
  updateMessage: (chatId: string, tempId: string, realMessage: ChatMessage) => void
  markChatRead: (chatId: string) => void

  // Online users & typing
  onlineUsers: OnlineUser[]
  typingByUserId: Record<string, boolean>

  setOnlineUsers: (users: OnlineUser[]) => void
  setUserOnline: (user: OnlineUser) => void
  setUserOffline: (userId: string) => void
  setTyping: (userId: string, isTyping: boolean) => void

  // Connection
  isSocketConnected: boolean
  setSocketConnected: (v: boolean) => void

  // UI state
  showProfilePanel: boolean
  showNewChatModal: boolean
  toggleProfilePanel: () => void
  setShowNewChatModal: (v: boolean) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  currentUser: null,
  isAuthLoading: true,
  setAuthLoading: (v) => set({ isAuthLoading: v }),
  setCurrentUser: (u) => set({ currentUser: u }),

  chats: [],
  activeChatId: null,
  activeChatOtherUser: null,
  messagesByChat: {},

  setChats: (chats) => set({ chats }),

  upsertChat: (chat) =>
    set((state) => {
      const existing = state.chats.findIndex((c) => c.id === chat.id)
      if (existing === -1) {
        return { chats: [chat, ...state.chats] }
      }
      const next = [...state.chats]
      next[existing] = chat
      // Move to top
      const [item] = next.splice(existing, 1)
      next.unshift(item)
      return { chats: next }
    }),

  setActiveChat: (chatId, otherUser) => {
    set({ activeChatId: chatId, activeChatOtherUser: otherUser })
    if (chatId) {
      // Clear unread count for the active chat
      set((state) => ({
        chats: state.chats.map((c) =>
          c.id === chatId ? { ...c, unreadCount: 0 } : c
        ),
      }))
    }
  },

  setMessages: (chatId, messages) =>
    set((state) => ({
      messagesByChat: { ...state.messagesByChat, [chatId]: messages },
    })),

  addMessage: (chatId, message) =>
    set((state) => {
      const existing = state.messagesByChat[chatId] || []
      // Avoid duplicate by id
      if (existing.find((m) => m.id === message.id)) return state
      return {
        messagesByChat: {
          ...state.messagesByChat,
          [chatId]: [...existing, message],
        },
      }
    }),

  updateMessage: (chatId, tempId, realMessage) =>
    set((state) => {
      const existing = state.messagesByChat[chatId] || []
      const next = existing.map((m) =>
        m.id === tempId ? { ...realMessage, pending: false } : m
      )
      return {
        messagesByChat: { ...state.messagesByChat, [chatId]: next },
      }
    }),

  markChatRead: (chatId) =>
    set((state) => {
      const messages = state.messagesByChat[chatId] || []
      return {
        messagesByChat: {
          ...state.messagesByChat,
          [chatId]: messages.map((m) => ({ ...m, read: m.receiverId === state.currentUser?.id ? true : m.read })),
        },
        chats: state.chats.map((c) =>
          c.id === chatId ? { ...c, unreadCount: 0 } : c
        ),
      }
    }),

  onlineUsers: [],
  typingByUserId: {},

  setOnlineUsers: (users) => set({ onlineUsers: users }),
  setUserOnline: (user) =>
    set((state) => {
      const exists = state.onlineUsers.find((u) => u.userId === user.userId)
      if (exists) return state
      return { onlineUsers: [...state.onlineUsers, user] }
    }),
  setUserOffline: (userId) =>
    set((state) => ({
      onlineUsers: state.onlineUsers.filter((u) => u.userId !== userId),
    })),
  setTyping: (userId, isTyping) =>
    set((state) => ({
      typingByUserId: { ...state.typingByUserId, [userId]: isTyping },
    })),

  isSocketConnected: false,
  setSocketConnected: (v) => set({ isSocketConnected: v }),

  showProfilePanel: false,
  showNewChatModal: false,
  toggleProfilePanel: () => set((s) => ({ showProfilePanel: !s.showProfilePanel })),
  setShowNewChatModal: (v) => set({ showNewChatModal: v }),
}))
