'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { AuthScreen } from '@/components/chat/AuthScreen'
import { ChatList } from '@/components/chat/ChatList'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { NewChatModal } from '@/components/chat/NewChatModal'
import { CreateGroupModal } from '@/components/chat/CreateGroupModal'
import { CreateChannelModal } from '@/components/chat/CreateChannelModal'
import { CreateStoryModal } from '@/components/chat/CreateStoryModal'
import { CreateBotModal } from '@/components/chat/CreateBotModal'
import { StoriesViewer } from '@/components/chat/StoriesViewer'
import { CallPanel } from '@/components/chat/CallPanel'
import { ProfilePanel } from '@/components/chat/ProfilePanel'
import { GroupInfoPanel } from '@/components/chat/GroupInfoPanel'
import { useChatSocket } from '@/components/chat/useChatSocket'
import { useChatStore } from '@/lib/chat-store'
import { useExtendedStore } from '@/lib/extended-store'
import { Loader2, Zap } from 'lucide-react'

export default function Home() {
  useChatSocket()

  const currentUser = useChatStore((s) => s.currentUser)
  const isAuthLoading = useChatStore((s) => s.isAuthLoading)
  const activeConversation = useChatStore((s) => s.activeConversation)

  const setShowNewChatModal = useChatStore((s) => s.setShowNewChatModal)
  const showNewChatModal = useChatStore((s) => s.showNewChatModal)
  const setShowCreateGroupModal = useChatStore((s) => s.setShowCreateGroupModal)
  const showCreateGroupModal = useChatStore((s) => s.showCreateGroupModal)
  const setShowGroupInfoPanel = useChatStore((s) => s.setShowGroupInfoPanel)
  const showGroupInfoPanel = useChatStore((s) => s.showGroupInfoPanel)

  // Extended store
  const setShowCreateChannelModal = useExtendedStore((s) => s.setShowCreateChannelModal)
  const showCreateChannelModal = useExtendedStore((s) => s.showCreateChannelModal)
  const setShowCreateStoryModal = useExtendedStore((s) => s.setShowCreateStoryModal)
  const showCreateStoryModal = useExtendedStore((s) => s.showCreateStoryModal)
  const setShowCreateBotModal = useExtendedStore((s) => s.setShowCreateBotModal)
  const showCreateBotModal = useExtendedStore((s) => s.showCreateBotModal)
  const showStoriesViewer = useExtendedStore((s) => s.showStoriesViewer)
  const setShowStoriesViewer = useExtendedStore((s) => s.setShowStoriesViewer)

  // Call state
  const call = useExtendedStore((s) => s.call)
  const setCall = useExtendedStore((s) => s.setCall)

  const [showProfile, setShowProfile] = useState(false)
  const [viewProfileId, setViewProfileId] = useState<string | null>(null)
  const [viewGroupId, setViewGroupId] = useState<string | null>(null)

  const hasActive = !!activeConversation

  useEffect(() => {
    if (!showProfile) {
      const t = setTimeout(() => setViewProfileId(null), 200)
      return () => clearTimeout(t)
    }
  }, [showProfile])

  useEffect(() => {
    if (!showGroupInfoPanel) {
      const t = setTimeout(() => setViewGroupId(null), 200)
      return () => clearTimeout(t)
    }
  }, [showGroupInfoPanel])

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
        className={`${hasActive ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 border-r border-border shrink-0 flex-col`}
      >
        <ChatList
          onOpenNewChat={() => setShowNewChatModal(true)}
          onOpenCreateGroup={() => setShowCreateGroupModal(true)}
          onOpenCreateChannel={() => setShowCreateChannelModal(true)}
          onOpenCreateStory={() => setShowCreateStoryModal(true)}
          onOpenCreateBot={() => setShowCreateBotModal(true)}
          onOpenProfile={() => {
            setViewProfileId(null)
            setShowProfile(true)
          }}
          onOpenGroupInfo={(groupId) => {
            setViewGroupId(groupId)
            setShowGroupInfoPanel(true)
          }}
        />
      </aside>

      {/* Main chat area */}
      <main className={`${hasActive ? 'flex' : 'hidden md:flex'} flex-1 min-w-0`}>
        <ChatWindow
          onBack={() => useChatStore.getState().setActiveConversation(null)}
          onOpenUserProfile={(userId) => {
            setViewProfileId(userId)
            setShowProfile(true)
          }}
          onOpenGroupInfo={(groupId) => {
            setViewGroupId(groupId)
            setShowGroupInfoPanel(true)
          }}
        />
      </main>

      {/* Modals */}
      <NewChatModal open={showNewChatModal} onOpenChange={setShowNewChatModal} />
      <CreateGroupModal open={showCreateGroupModal} onOpenChange={setShowCreateGroupModal} />
      <CreateChannelModal open={showCreateChannelModal} onOpenChange={setShowCreateChannelModal} />
      <CreateStoryModal open={showCreateStoryModal} onOpenChange={setShowCreateStoryModal} />
      <CreateBotModal open={showCreateBotModal} onOpenChange={setShowCreateBotModal} />
      <ProfilePanel
        open={showProfile}
        onOpenChange={setShowProfile}
        viewUserId={viewProfileId}
      />
      <GroupInfoPanel
        open={showGroupInfoPanel}
        onOpenChange={setShowGroupInfoPanel}
        groupId={viewGroupId}
      />

      {/* Stories viewer */}
      <AnimatePresence>
        {showStoriesViewer && <StoriesViewer />}
      </AnimatePresence>

      {/* Call panel */}
      <AnimatePresence>
        {call && (
          <CallPanel
            call={call}
            onEnd={() => setCall(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
