'use client'

import { create } from 'zustand'
import type { ChatMessage } from './chat-store'

// ============================================================
// Types for new features
// ============================================================
export interface Reaction {
  emoji: string
  count: number
  users: { id: string; username: string; displayName: string; avatarColor: string }[]
  mine: boolean
}

export interface Channel {
  id: string
  username: string
  name: string
  description: string
  avatarColor: string
  isPrivate: boolean
  creatorId: string
  createdAt: string
  updatedAt: string
  subscriberCount: number
  lastPost?: ChatMessage | null
  role?: 'owner' | 'admin' | 'subscriber' | null
  isChannel: true
}

export interface Story {
  id: string
  userId: string
  type: 'image' | 'text'
  mediaUrl?: string | null
  text?: string | null
  bgColor: string
  createdAt: string
  expiresAt: string
  views: number
  viewedByMe: boolean
  isMine: boolean
}

export interface StoryGroup {
  user: {
    id: string
    username: string
    displayName: string
    avatarColor: string
  }
  stories: Story[]
}

export interface Bot {
  id: string
  username: string
  displayName: string
  description: string
  avatarColor: string
  ownerId?: string
  webhookUrl?: string | null
  createdAt?: string
  token?: string // only on create
}

export interface CallState {
  callId: string
  otherUserId: string
  otherUserName: string
  otherUserAvatarColor: string
  callType: 'audio' | 'video'
  direction: 'incoming' | 'outgoing'
  status: 'ringing' | 'connecting' | 'connected' | 'ended'
  // WebRTC state
  localStream?: MediaStream | null
  remoteStream?: MediaStream | null
  isMuted: boolean
  isVideoOff: boolean
}

export interface ChatSettings {
  archived: boolean
  muted: boolean
  autoDeleteSecs: number
  pinnedMessageId?: string | null
}

interface ExtendedState {
  // Reactions by message id
  reactionsByMessage: Record<string, Reaction[]>

  setReactions: (messageId: string, reactions: Reaction[]) => void
  toggleReactionLocal: (messageId: string, emoji: string, userId: string, action: 'added' | 'removed') => void
  addReaction: (messageId: string, reaction: Reaction) => void

  // Reply / edit state (within ChatWindow input area)
  replyTo: ChatMessage | null
  editingMessage: ChatMessage | null
  setReplyTo: (msg: ChatMessage | null) => void
  setEditingMessage: (msg: ChatMessage | null) => void

  // Pinned messages by chatId/groupId
  pinnedMessages: Record<string, ChatMessage | null>
  setPinnedMessage: (convId: string, msg: ChatMessage | null) => void

  // Chat settings
  chatSettings: Record<string, ChatSettings>
  setChatSettings: (convId: string, settings: ChatSettings) => void

  // Silent send flag
  silentSend: boolean
  setSilentSend: (v: boolean) => void

  // Channels
  channels: Channel[]
  setChannels: (channels: Channel[]) => void
  upsertChannel: (channel: Channel) => void
  removeChannel: (channelId: string) => void
  activeChannel: Channel | null
  setActiveChannel: (channel: Channel | null) => void

  // Stories
  storyGroups: StoryGroup[]
  setStoryGroups: (groups: StoryGroup[]) => void

  // Bots
  myBots: Bot[]
  setMyBots: (bots: Bot[]) => void

  // Voice Calls
  call: CallState | null
  setCall: (call: CallState | null) => void
  updateCall: (patch: Partial<CallState>) => void

  // UI panels
  showCreateChannelModal: boolean
  setShowCreateChannelModal: (v: boolean) => void
  showCreateStoryModal: boolean
  setShowCreateStoryModal: (v: boolean) => void
  showCreateBotModal: boolean
  setShowCreateBotModal: (v: boolean) => void
  showBotDirectory: boolean
  setShowBotDirectory: (v: boolean) => void
  showStoriesViewer: boolean
  setShowStoriesViewer: (v: boolean) => void
  viewingStoryGroupIndex: number
  setViewingStoryGroupIndex: (i: number) => void
}

export const useExtendedStore = create<ExtendedState>((set) => ({
  // Reactions
  reactionsByMessage: {},
  setReactions: (messageId, reactions) =>
    set((s) => ({
      reactionsByMessage: { ...s.reactionsByMessage, [messageId]: reactions },
    })),
  toggleReactionLocal: (messageId, emoji, userId, action) =>
    set((s) => {
      const existing = s.reactionsByMessage[messageId] || []
      if (action === 'added') {
        // Find or create the emoji group
        const idx = existing.findIndex((r) => r.emoji === emoji)
        if (idx >= 0) {
          const next = [...existing]
          next[idx] = {
            ...next[idx],
            count: next[idx].count + 1,
            mine: true, // assuming userId is me
            users: [...next[idx].users, {
              id: userId, username: '', displayName: 'You', avatarColor: '#6366f1',
            }],
          }
          return { reactionsByMessage: { ...s.reactionsByMessage, [messageId]: next } }
        } else {
          return {
            reactionsByMessage: {
              ...s.reactionsByMessage,
              [messageId]: [...existing, {
                emoji, count: 1, mine: true,
                users: [{ id: userId, username: '', displayName: 'You', avatarColor: '#6366f1' }],
              }],
            },
          }
        }
      } else {
        // removed
        const idx = existing.findIndex((r) => r.emoji === emoji)
        if (idx >= 0) {
          const next = [...existing]
          if (next[idx].count <= 1) {
            next.splice(idx, 1)
          } else {
            next[idx] = {
              ...next[idx],
              count: next[idx].count - 1,
              mine: false,
            }
          }
          return { reactionsByMessage: { ...s.reactionsByMessage, [messageId]: next } }
        }
      }
      return s
    }),
  addReaction: (messageId, reaction) =>
    set((s) => {
      const existing = s.reactionsByMessage[messageId] || []
      if (existing.find((r) => r.emoji === reaction.emoji)) return s
      return {
        reactionsByMessage: { ...s.reactionsByMessage, [messageId]: [...existing, reaction] },
      }
    }),

  // Reply / edit
  replyTo: null,
  editingMessage: null,
  setReplyTo: (msg) => set({ replyTo: msg, editingMessage: msg ? null : (s) => s.editingMessage }),
  setEditingMessage: (msg) => set({ editingMessage: msg, replyTo: msg ? null : (s) => s.replyTo }),

  // Pinned messages
  pinnedMessages: {},
  setPinnedMessage: (convId, msg) =>
    set((s) => ({
      pinnedMessages: { ...s.pinnedMessages, [convId]: msg },
    })),

  // Chat settings
  chatSettings: {},
  setChatSettings: (convId, settings) =>
    set((s) => ({
      chatSettings: { ...s.chatSettings, [convId]: settings },
    })),

  // Silent send
  silentSend: false,
  setSilentSend: (v) => set({ silentSend: v }),

  // Channels
  channels: [],
  setChannels: (channels) => set({ channels }),
  upsertChannel: (channel) =>
    set((s) => {
      const idx = s.channels.findIndex((c) => c.id === channel.id)
      if (idx === -1) return { channels: [channel, ...s.channels] }
      const next = [...s.channels]
      next[idx] = channel
      return { channels: next }
    }),
  removeChannel: (channelId) =>
    set((s) => ({ channels: s.channels.filter((c) => c.id !== channelId) })),
  activeChannel: null,
  setActiveChannel: (channel) => set({ activeChannel: channel }),

  // Stories
  storyGroups: [],
  setStoryGroups: (groups) => set({ storyGroups: groups }),

  // Bots
  myBots: [],
  setMyBots: (bots) => set({ myBots: bots }),

  // Calls
  call: null,
  setCall: (call) => set({ call }),
  updateCall: (patch) =>
    set((s) => (s.call ? { call: { ...s.call, ...patch } } : s)),

  // UI panels
  showCreateChannelModal: false,
  setShowCreateChannelModal: (v) => set({ showCreateChannelModal: v }),
  showCreateStoryModal: false,
  setShowCreateStoryModal: (v) => set({ showCreateStoryModal: v }),
  showCreateBotModal: false,
  setShowCreateBotModal: (v) => set({ showCreateBotModal: v }),
  showBotDirectory: false,
  setShowBotDirectory: (v) => set({ showBotDirectory: v }),
  showStoriesViewer: false,
  setShowStoriesViewer: (v) => set({ showStoriesViewer: v }),
  viewingStoryGroupIndex: 0,
  setViewingStoryGroupIndex: (i) => set({ viewingStoryGroupIndex: i }),
}))
