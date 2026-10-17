'use client'

import { useState, useMemo } from 'react'
import { Search, Plus, Settings, Zap, LogOut, CheckCheck, Check, X, Users, MessageCircle } from 'lucide-react'
import { Avatar } from './Avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useChatStore, type ChatListItem } from '@/lib/chat-store'
import { formatTime } from '@/lib/chat-utils'
import { cn } from '@/lib/utils'

interface ChatListProps {
  onOpenNewChat: () => void
  onOpenCreateGroup: () => void
  onOpenProfile: () => void
  onOpenGroupInfo: (groupId: string) => void
}

export function ChatList({ onOpenNewChat, onOpenCreateGroup, onOpenProfile, onOpenGroupInfo }: ChatListProps) {
  const chats = useChatStore((s) => s.chats)
  const activeConversation = useChatStore((s) => s.activeConversation)
  const setActiveDirect = useChatStore((s) => s.setActiveDirect)
  const setActiveGroup = useChatStore((s) => s.setActiveGroup)
  const onlineUsers = useChatStore((s) => s.onlineUsers)
  const currentUser = useChatStore((s) => s.currentUser)
  const [search, setSearch] = useState('')

  const filteredChats = useMemo(() => {
    if (!search.trim()) return chats
    const q = search.toLowerCase()
    return chats.filter((c) => {
      if (c.isGroup && c.group) {
        return c.group.name.toLowerCase().includes(q) || c.lastMessage?.content.toLowerCase().includes(q)
      }
      if (c.otherUser) {
        return (
          c.otherUser.username.toLowerCase().includes(q) ||
          c.otherUser.displayName.toLowerCase().includes(q) ||
          c.lastMessage?.content.toLowerCase().includes(q)
        )
      }
      return false
    })
  }, [chats, search])

  const handleChatClick = (chat: ChatListItem) => {
    if (chat.isGroup && chat.group) {
      // Find the group info from store
      const groupInfo = useChatStore.getState().groups.find((g) => g.id === chat.id)
      if (groupInfo) {
        setActiveGroup(groupInfo)
      } else {
        // Fetch group info
        import('@/lib/chat-utils').then(({ apiFetch }) => {
          apiFetch<{ group: any }>(`/api/groups/${chat.id}`)
            .then((data) => {
              useChatStore.getState().upsertGroup(data.group)
              setActiveGroup(data.group)
            })
            .catch(() => {})
        })
      }
    } else if (chat.otherUser) {
      setActiveDirect(chat.id, chat.otherUser)
    }
  }

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.clear()
      window.location.reload()
    }
  }

  const activeId = activeConversation?.type === 'direct'
    ? activeConversation.chatId
    : activeConversation?.type === 'group'
    ? activeConversation.groupId
    : null

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md shadow-primary/20">
              <Zap className="h-5 w-5" fill="currentColor" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-none">ZapChat</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {onlineUsers.length + (currentUser ? 1 : 0)} online
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full hover:bg-sidebar-accent"
              onClick={onOpenProfile}
              title="Profile settings"
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full hover:bg-sidebar-accent"
              onClick={handleLogout}
              title="Log out"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="pl-9 h-10 bg-background/50 border-sidebar-border"
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

      {/* New chat / group button */}
      <div className="px-3 pt-3 flex gap-2">
        <Button
          onClick={onOpenNewChat}
          variant="outline"
          className="flex-1 h-10 justify-start gap-2 border-dashed border-sidebar-border hover:bg-sidebar-accent"
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>
        <Button
          onClick={onOpenCreateGroup}
          variant="outline"
          className="flex-1 h-10 justify-start gap-2 border-dashed border-sidebar-border hover:bg-sidebar-accent"
        >
          <Users className="h-4 w-4" />
          New group
        </Button>
      </div>

      {/* Chat list */}
      <ScrollArea className="flex-1 px-2 py-2 scrollbar-thin">
        {filteredChats.length === 0 ? (
          <EmptyChatList hasSearch={!!search.trim()} onNewChat={onOpenNewChat} />
        ) : (
          <div className="space-y-0.5">
            {filteredChats.map((chat) => (
              <ChatRow
                key={chat.id}
                chat={chat}
                isActive={chat.id === activeId}
                onClick={() => handleChatClick(chat)}
                onOpenGroupInfo={onOpenGroupInfo}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* User profile footer */}
      {currentUser && (
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={onOpenProfile}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-sidebar-accent transition-colors text-left"
          >
            <Avatar
              name={currentUser.displayName}
              color={currentUser.avatarColor}
              size="md"
              online
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{currentUser.displayName}</p>
              <p className="text-xs text-muted-foreground truncate">@{currentUser.username}</p>
            </div>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// ChatRow
// ============================================================
function ChatRow({
  chat,
  isActive,
  onClick,
  onOpenGroupInfo,
}: {
  chat: ChatListItem
  isActive: boolean
  onClick: () => void
  onOpenGroupInfo: (groupId: string) => void
}) {
  const onlineUsers = useChatStore((s) => s.onlineUsers)
  const currentUser = useChatStore((s) => s.currentUser)

  if (chat.isGroup && chat.group) {
    const lastMessage = chat.lastMessage
    const isOwnLast = lastMessage?.senderId === currentUser?.id
    const senderName = lastMessage && !isOwnLast && lastMessage.sender
      ? lastMessage.sender.displayName.split(' ')[0]
      : null

    return (
      <div
        className={cn(
          'w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left group cursor-pointer',
          isActive ? 'bg-sidebar-accent shadow-sm' : 'hover:bg-sidebar-accent/60'
        )}
        onClick={onClick}
      >
        <div
          className="relative h-10 w-10 rounded-full flex items-center justify-center text-white ring-2 ring-background shrink-0"
          style={{ background: chat.group.avatarColor }}
        >
          <Users className="h-5 w-5" />
          {chat.group.memberCount > 0 && (
            <span className="absolute -bottom-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-background text-foreground text-[10px] font-bold flex items-center justify-center border border-border">
              {chat.group.memberCount}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm truncate">{chat.group.name}</span>
            {lastMessage && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatTime(lastMessage.createdAt)}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <div className="flex items-center gap-1 text-xs text-muted-foreground truncate min-w-0 flex-1">
              {isOwnLast && lastMessage && (
                <span className="shrink-0">
                  {lastMessage.read ? (
                    <CheckCheck className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                </span>
              )}
              <span className="truncate">
                {lastMessage ? (
                  <>
                    {senderName && <span className="text-foreground/70">{senderName}: </span>}
                    {lastMessage.type === 'image' ? '📷 Photo' :
                     lastMessage.type === 'file' ? `📎 ${lastMessage.fileName || 'File'}` :
                     lastMessage.content}
                  </>
                ) : (
                  <span className="italic text-muted-foreground/70">No messages yet</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenGroupInfo(chat.id)
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-muted transition-all"
                title="Group info"
              >
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {chat.unreadCount > 0 && (
                <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Direct chat row
  if (!chat.otherUser) return null
  const isOnline = onlineUsers.some((u) => u.userId === chat.otherUser!.id)
  const lastMessage = chat.lastMessage
  const isOwnLast = lastMessage?.senderId === currentUser?.id

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left group',
        isActive ? 'bg-sidebar-accent shadow-sm' : 'hover:bg-sidebar-accent/60'
      )}
    >
      <Avatar
        name={chat.otherUser.displayName}
        color={chat.otherUser.avatarColor}
        size="md"
        online={isOnline}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm truncate">{chat.otherUser.displayName}</span>
          {lastMessage && (
            <span className="text-[10px] text-muted-foreground shrink-0">
              {formatTime(lastMessage.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div className="flex items-center gap-1 text-xs text-muted-foreground truncate min-w-0 flex-1">
            {isOwnLast && lastMessage && (
              <span className="shrink-0">
                {lastMessage.read ? (
                  <CheckCheck className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </span>
            )}
            <span className="truncate">
              {lastMessage ? (
                lastMessage.type === 'image' ? '📷 Photo' :
                lastMessage.type === 'file' ? `📎 ${lastMessage.fileName || 'File'}` :
                lastMessage.content
              ) : (
                <span className="italic text-muted-foreground/70">No messages yet</span>
              )}
            </span>
          </div>
          {chat.unreadCount > 0 && (
            <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function EmptyChatList({ hasSearch, onNewChat }: { hasSearch: boolean; onNewChat: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <MessageCircle className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium mb-1">
        {hasSearch ? 'No chats found' : 'No conversations yet'}
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        {hasSearch ? 'Try a different search term.' : 'Start a new conversation or create a group.'}
      </p>
      {!hasSearch && (
        <Button onClick={onNewChat} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Start chatting
        </Button>
      )}
    </div>
  )
}
