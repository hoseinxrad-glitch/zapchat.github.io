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

export interface GroupMember {
  id: string
  role: 'admin' | 'member'
  joinedAt: string
  user: ChatUser
}

export interface GroupInfo {
  id: string
  name: string
  description: string
  avatarColor: string
  creatorId: string
  createdAt: string
  updatedAt: string
  members: GroupMember[]
  isGroup: true
}

export interface ChatMessage {
  id: string
  chatId?: string | null
  groupId?: string | null
  content: string
  type: 'text' | 'image' | 'file'
  fileUrl?: string | null
  fileName?: string | null
  fileSize?: number | null
  senderId: string
  receiverId?: string | null
  read: boolean
  createdAt: string
  sender?: { id: string; username: string; displayName: string; avatarColor: string }
  pending?: boolean // client-only flag
}

export interface ChatListItem {
  id: string
  isGroup?: boolean
  // For direct chats
  otherUser?: ChatUser
  // For groups
  group?: {
    id: string
    name: string
    description: string
    avatarColor: string
    creatorId: string
    memberCount: number
  }
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

// ============================================================
// Active conversation context - either direct or group
// ============================================================
export interface ActiveDirectContext {
  type: 'direct'
  chatId: string
  otherUser: ChatUser
}
export interface ActiveGroupContext {
  type: 'group'
  groupId: string
  group: GroupInfo
}
export type ActiveConversation = ActiveDirectContext | ActiveGroupContext | null

interface ChatState {
  // Auth
  currentUser: AuthUser | null
  isAuthLoading: boolean

  setAuthLoading: (v: boolean) => void
  setCurrentUser: (u: AuthUser | null) => void

  // Chats (direct + group combined list)
  chats: ChatListItem[]
  groups: GroupInfo[] // separate groups list for management
  activeConversation: ActiveConversation
  messagesByConversation: Record<string, ChatMessage[]> // key = chatId or groupId

  setChats: (chats: ChatListItem[]) => void
  upsertChat: (chat: ChatListItem) => void
  setGroups: (groups: GroupInfo[]) => void
  upsertGroup: (group: GroupInfo) => void
  removeGroup: (groupId: string) => void
  setActiveDirect: (chatId: string, otherUser: ChatUser) => void
  setActiveGroup: (group: GroupInfo) => void
  setActiveConversation: (conv: ActiveConversation) => void
  setMessages: (convId: string, messages: ChatMessage[]) => void
  addMessage: (convId: string, message: ChatMessage) => void
  updateMessage: (convId: string, tempId: string, realMessage: ChatMessage) => void
  removeMessage: (convId: string, messageId: string) => void
  markChatRead: (convId: string) => void

  // Online users & typing
  onlineUsers: OnlineUser[]
  typingByUserId: Record<string, boolean>
  typingByGroup: Record<string, { userId: string; username: string } | null>

  setOnlineUsers: (users: OnlineUser[]) => void
  setUserOnline: (user: OnlineUser) => void
  setUserOffline: (userId: string) => void
  setTyping: (userId: string, isTyping: boolean) => void
  setGroupTyping: (groupId: string, typing: { userId: string; username: string } | null) => void

  // Connection
  isSocketConnected: boolean
  setSocketConnected: (v: boolean) => void

  // UI state
  showProfilePanel: boolean
  showNewChatModal: boolean
  showCreateGroupModal: boolean
  showGroupInfoPanel: boolean
  viewProfileUserId: string | null
  toggleProfilePanel: () => void
  setShowNewChatModal: (v: boolean) => void
  setShowCreateGroupModal: (v: boolean) => void
  setShowGroupInfoPanel: (v: boolean) => void
  setViewProfileUserId: (id: string | null) => void
}

export const useChatStore = create<ChatState>((set) => ({
  currentUser: null,
  isAuthLoading: true,
  setAuthLoading: (v) => set({ isAuthLoading: v }),
  setCurrentUser: (u) => set({ currentUser: u }),

  chats: [],
  groups: [],
  activeConversation: null,
  messagesByConversation: {},

  setChats: (chats) => set({ chats }),

  upsertChat: (chat) =>
    set((state) => {
      const idx = state.chats.findIndex((c) => c.id === chat.id)
      if (idx === -1) return { chats: [chat, ...state.chats] }
      const next = [...state.chats]
      next[idx] = { ...next[idx], ...chat }
      // Move to top
      const [item] = next.splice(idx, 1)
      next.unshift(item)
      return { chats: next }
    }),

  setGroups: (groups) => set({ groups }),

  upsertGroup: (group) =>
    set((state) => {
      const idx = state.groups.findIndex((g) => g.id === group.id)
      if (idx === -1) return { groups: [group, ...state.groups] }
      const next = [...state.groups]
      next[idx] = group
      return { groups: next }
    }),

  removeGroup: (groupId) =>
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== groupId),
      chats: state.chats.filter((c) => c.id !== groupId),
    })),

  setActiveDirect: (chatId, otherUser) =>
    set((state) => ({
      activeConversation: { type: 'direct', chatId, otherUser },
      chats: state.chats.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c)),
    })),

  setActiveGroup: (group) =>
    set((state) => ({
      activeConversation: { type: 'group', groupId: group.id, group },
      chats: state.chats.map((c) => (c.id === group.id ? { ...c, unreadCount: 0 } : c)),
    })),

  setActiveConversation: (conv) => set({ activeConversation: conv }),

  setMessages: (convId, messages) =>
    set((state) => ({
      messagesByConversation: { ...state.messagesByConversation, [convId]: messages },
    })),

  addMessage: (convId, message) =>
    set((state) => {
      const existing = state.messagesByConversation[convId] || []
      if (existing.find((m) => m.id === message.id)) return state
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [convId]: [...existing, message],
        },
      }
    }),

  updateMessage: (convId, tempId, realMessage) =>
    set((state) => {
      const existing = state.messagesByConversation[convId] || []
      const next = existing.map((m) =>
        m.id === tempId ? { ...realMessage, pending: false } : m
      )
      return {
        messagesByConversation: { ...state.messagesByConversation, [convId]: next },
      }
    }),

  removeMessage: (convId, messageId) =>
    set((state) => {
      const existing = state.messagesByConversation[convId] || []
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [convId]: existing.filter((m) => m.id !== messageId),
        },
      }
    }),

  markChatRead: (convId) =>
    set((state) => {
      const messages = state.messagesByConversation[convId] || []
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [convId]: messages.map((m) => ({
            ...m,
            read: m.receiverId === state.currentUser?.id ? true : m.read,
          })),
        },
        chats: state.chats.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c)),
      }
    }),

  onlineUsers: [],
  typingByUserId: {},
  typingByGroup: {},

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
  setGroupTyping: (groupId, typing) =>
    set((state) => ({
      typingByGroup: { ...state.typingByGroup, [groupId]: typing },
    })),

  isSocketConnected: false,
  setSocketConnected: (v) => set({ isSocketConnected: v }),

  showProfilePanel: false,
  showNewChatModal: false,
  showCreateGroupModal: false,
  showGroupInfoPanel: false,
  viewProfileUserId: null,
  toggleProfilePanel: () => set((s) => ({ showProfilePanel: !s.showProfilePanel })),
  setShowNewChatModal: (v) => set({ showNewChatModal: v }),
  setShowCreateGroupModal: (v) => set({ showCreateGroupModal: v }),
  setShowGroupInfoPanel: (v) => set({ showGroupInfoPanel: v }),
  setViewProfileUserId: (id) => set({ viewProfileUserId: id }),
}))
