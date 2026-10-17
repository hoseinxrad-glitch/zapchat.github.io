'use client'

import { useEffect, useState } from 'react'
import { AuthScreen } from '@/components/chat/AuthScreen'
import { ChatList } from '@/components/chat/ChatList'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { NewChatModal } from '@/components/chat/NewChatModal'
import { ProfilePanel } from '@/components/chat/ProfilePanel'
import { useChatSocket } from '@/components/chat/useChatSocket'
import { useChatStore } from '@/lib/chat-store'
import { Loader2, Zap } from 'lucide-react'

export default function Home() {
  useChatSocket()

  const currentUser = useChatStore((s) => s.currentUser)
  const isAuthLoading = useChatStore((s) => s.isAuthLoading)
  const activeChatId = useChatStore((s) => s.activeChatId)
  const setShowNewChatModal = useChatStore((s) => s.setShowNewChatModal)
  const showNewChatModal = useChatStore((s) => s.showNewChatModal)

  const [showProfile, setShowProfile] = useState(false)
  const [viewProfileId, setViewProfileId] = useState<string | null>(null)

  // Reset view profile when closing
  useEffect(() => {
    if (!showProfile) {
      const t = setTimeout(() => setViewProfileId(null), 200)
      return () => clearTimeout(t)
    }
  }, [showProfile])

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-xl shadow-primary/30 animate-pulse">
          <Zap className="h-8 w-8" fill="currentColor" />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading ZapChat...
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <AuthScreen />
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-background">
      {/* Sidebar - chat list */}
      <aside
        className={`${
          activeChatId ? 'hidden md:flex' : 'flex'
        } w-full md:w-80 lg:w-96 border-r border-border shrink-0 flex-col`}
      >
        <ChatList
          onOpenNewChat={() => setShowNewChatModal(true)}
          onOpenProfile={() => {
            setViewProfileId(null)
            setShowProfile(true)
          }}
        />
      </aside>

      {/* Main chat area */}
      <main
        className={`${
          activeChatId ? 'flex' : 'hidden md:flex'
        } flex-1 min-w-0`}
      >
        <ChatWindow
          onBack={() => useChatStore.getState().setActiveChat(null, null)}
          onOpenProfile={(userId) => {
            setViewProfileId(userId)
            setShowProfile(true)
          }}
        />
      </main>

      {/* Modals */}
      <NewChatModal
        open={showNewChatModal}
        onOpenChange={setShowNewChatModal}
      />
      <ProfilePanel
        open={showProfile}
        onOpenChange={setShowProfile}
        viewUserId={viewProfileId}
      />
    </div>
  )
}
