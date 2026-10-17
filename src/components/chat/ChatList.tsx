'use client'

import { useState, useMemo } from 'react'
import { Search, Plus, Settings, Zap, LogOut, CheckCheck, Check, X } from 'lucide-react'
import { Avatar } from './Avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatStore } from '@/lib/chat-store'
import { formatTime } from '@/lib/chat-utils'
import { cn } from '@/lib/utils'

export function ChatList({ onOpenNewChat, onOpenProfile }: {
  onOpenNewChat: () => void
  onOpenProfile: () => void
}) {
  const chats = useChatStore((s) => s.chats)
  const activeChatId = useChatStore((s) => s.activeChatId)
  const setActiveChat = useChatStore((s) => s.setActiveChat)
  const onlineUsers = useChatStore((s) => s.onlineUsers)
  const currentUser = useChatStore((s) => s.currentUser)
  const [search, setSearch] = useState('')

  const filteredChats = useMemo(() => {
    if (!search.trim()) return chats
    const q = search.toLowerCase()
    return chats.filter(
      (c) =>
        c.otherUser.username.toLowerCase().includes(q) ||
        c.otherUser.displayName.toLowerCase().includes(q) ||
        c.lastMessage?.content.toLowerCase().includes(q)
    )
  }, [chats, search])

  const handleChatClick = (chatId: string, otherUser: any) => {
    setActiveChat(chatId, otherUser)
  }

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.clear()
      window.location.reload()
    }
  }

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

      {/* New chat button */}
      <div className="px-3 pt-3">
        <Button
          onClick={onOpenNewChat}
          variant="outline"
          className="w-full h-10 justify-start gap-2 border-dashed border-sidebar-border hover:bg-sidebar-accent"
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      {/* Chat list */}
      <ScrollArea className="flex-1 px-2 py-2 scrollbar-thin">
        {filteredChats.length === 0 ? (
          <EmptyChatList hasSearch={!!search.trim()} onNewChat={onOpenNewChat} />
        ) : (
          <div className="space-y-0.5">
            {filteredChats.map((chat) => {
              const isOnline = onlineUsers.some((u) => u.userId === chat.otherUser.id)
              const isActive = chat.id === activeChatId
              const lastMessage = chat.lastMessage
              const isOwnLast = lastMessage?.senderId === currentUser?.id

              return (
                <button
                  key={chat.id}
                  onClick={() => handleChatClick(chat.id, chat.otherUser)}
                  className={cn(
                    'w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left group',
                    isActive
                      ? 'bg-sidebar-accent shadow-sm'
                      : 'hover:bg-sidebar-accent/60'
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
                      <span className="font-semibold text-sm truncate">
                        {chat.otherUser.displayName}
                      </span>
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
            })}
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

function EmptyChatList({ hasSearch, onNewChat }: { hasSearch: boolean; onNewChat: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <Plus className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium mb-1">
        {hasSearch ? 'No chats found' : 'No conversations yet'}
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        {hasSearch ? 'Try a different search term.' : 'Start a new conversation to begin.'}
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
