'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Users, Radio, Bot, Camera, MessageSquare, BarChart3,
  Trash2, Ban, UserCheck, Crown, Loader2, X, Search,
  AlertTriangle, Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from './Avatar'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { useChatStore } from '@/lib/chat-store'
import { apiFetch, formatTime, formatLastSeen } from '@/lib/chat-utils'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AdminPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Tab = 'stats' | 'users' | 'groups' | 'channels' | 'bots' | 'stories'

export function AdminPanel({ open, onOpenChange }: AdminPanelProps) {
  const currentUser = useChatStore((s) => s.currentUser)
  const [tab, setTab] = useState<Tab>('stats')

  // Don't render for non-admins (still render sheet but with no access)
  if (!currentUser) return null
  const isAdmin = currentUser.role === 'admin'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl p-0 gap-0 overflow-hidden">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Admin Panel
          </SheetTitle>
          <SheetDescription>
            Manage users, channels, bots, stories, and content moderation.
          </SheetDescription>
        </SheetHeader>

        {!isAdmin ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-6">
            <Ban className="h-12 w-12 text-destructive mb-3" />
            <p className="text-sm font-medium mb-1">Access denied</p>
            <p className="text-xs text-muted-foreground">
              You need admin privileges to access this panel.
            </p>
          </div>
        ) : (
          <div className="flex flex-col h-[calc(100vh-4rem)]">
            {/* Tabs */}
            <div className="flex border-b border-border overflow-x-auto scrollbar-thin">
              <TabButton active={tab === 'stats'} onClick={() => setTab('stats')} icon={<BarChart3 className="h-4 w-4" />} label="Stats" />
              <TabButton active={tab === 'users'} onClick={() => setTab('users')} icon={<Users className="h-4 w-4" />} label="Users" />
              <TabButton active={tab === 'groups'} onClick={() => setTab('groups')} icon={<Users className="h-4 w-4" />} label="Groups" />
              <TabButton active={tab === 'channels'} onClick={() => setTab('channels')} icon={<Radio className="h-4 w-4" />} label="Channels" />
              <TabButton active={tab === 'bots'} onClick={() => setTab('bots')} icon={<Bot className="h-4 w-4" />} label="Bots" />
              <TabButton active={tab === 'stories'} onClick={() => setTab('stories')} icon={<Camera className="h-4 w-4" />} label="Stories" />
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 scrollbar-thin">
              <div className="p-4">
                {tab === 'stats' && <StatsTab />}
                {tab === 'users' && <UsersTab />}
                {tab === 'groups' && <GroupsTab />}
                {tab === 'channels' && <ChannelsTab />}
                {tab === 'bots' && <BotsTab />}
                {tab === 'stories' && <StoriesTab />}
              </div>
            </ScrollArea>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors shrink-0',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      )}
    >
      {icon}
      {label}
    </button>
  )
}

// ============================================================
// Stats Tab
// ============================================================
function StatsTab() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<{ stats: any }>('/api/admin?action=stats')
      .then((data) => setStats(data.stats))
      .catch((e) => toast.error(e.message || 'Failed to load stats'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />
  if (!stats) return null

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-500' },
    { label: 'Online (24h)', value: stats.onlineToday, icon: Activity, color: 'text-green-500' },
    { label: 'New (7d)', value: stats.recentUsers, icon: UserCheck, color: 'text-purple-500' },
    { label: 'Banned', value: stats.bannedUsers, icon: Ban, color: 'text-red-500' },
    { label: 'Groups', value: stats.totalGroups, icon: Users, color: 'text-orange-500' },
    { label: 'Channels', value: stats.totalChannels, icon: Radio, color: 'text-cyan-500' },
    { label: 'Bots', value: stats.totalBots, icon: Bot, color: 'text-emerald-500' },
    { label: 'Active Stories', value: stats.totalStories, icon: Camera, color: 'text-pink-500' },
    { label: 'Messages', value: stats.totalMessages, icon: MessageSquare, color: 'text-indigo-500' },
    { label: 'Today Messages', value: stats.messagesToday, icon: Activity, color: 'text-amber-500' },
    { label: 'Reactions', value: stats.totalReactions, icon: BarChart3, color: 'text-teal-500' },
  ]

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Overview</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <c.icon className={cn('h-4 w-4', c.color)} />
            </div>
            <p className="text-2xl font-bold">{c.value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Users Tab
// ============================================================
function UsersTab() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const currentUser = useChatStore((s) => s.currentUser)

  const loadUsers = (q: string) => {
    setLoading(true)
    apiFetch<{ users: any[] }>(`/api/admin?action=users&q=${encodeURIComponent(q)}&limit=50`)
      .then((data) => setUsers(data.users))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const t = setTimeout(() => loadUsers(''), 0)
    return () => clearTimeout(t)
  }, [])

  const handleAction = async (userId: string, action: 'ban' | 'unban' | 'promote' | 'demote') => {
    try {
      const data = await apiFetch<{ user: any }>(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      })
      setUsers((prev) => prev.map((u) => u.id === userId ? data.user : u))
      toast.success(`User ${action}ed successfully`)
    } catch (e: any) {
      toast.error(e.message || 'Action failed')
    }
  }

  const handleDelete = async (userId: string) => {
    try {
      await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      toast.success('User account deleted')
      setConfirmDelete(null)
    } catch (e: any) {
      toast.error(e.message || 'Delete failed')
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            if (window) {
              clearTimeout((window as any).__userSearch)
              ;(window as any).__userSearch = setTimeout(() => loadUsers(e.target.value), 300)
            }
          }}
          placeholder="Search by username or name..."
          className="pl-9"
        />
      </div>

      {loading ? <Loading /> : users.length === 0 ? (
        <Empty text="No users found" />
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const isSelf = u.id === currentUser?.id
            return (
              <div key={u.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
                <Avatar name={u.displayName} color={u.avatarColor} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold truncate">{u.displayName}</p>
                    {u.role === 'admin' && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-primary/15 text-primary">
                        <Crown className="h-2.5 w-2.5" />
                        Admin
                      </span>
                    )}
                    {u.isBanned && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-destructive/15 text-destructive">
                        Banned
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    @{u.username} · {u.messageCount} msgs · {formatLastSeen(u.lastSeen)}
                  </p>
                </div>
                {!isSelf && (
                  <div className="flex items-center gap-1">
                    {u.isBanned ? (
                      <Button size="sm" variant="ghost" onClick={() => handleAction(u.id, 'unban')} title="Unban">
                        <UserCheck className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleAction(u.id, 'ban')} title="Ban user">
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                    {u.role === 'admin' ? (
                      <Button size="sm" variant="ghost" onClick={() => handleAction(u.id, 'demote')} title="Demote to user">
                        <Crown className="h-4 w-4 opacity-50" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => handleAction(u.id, 'promote')} title="Promote to admin">
                        <Crown className="h-4 w-4 text-yellow-500" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(u.id)} title="Delete account">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Confirm delete dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete user account?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete the user and ALL their data: messages, groups, channels, bots, stories. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleDelete(confirmDelete!)}>
              Delete permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// Groups Tab
// ============================================================
function GroupsTab() {
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<{ groups: any[] }>('/api/admin?action=groups')
      .then((data) => setGroups(data.groups))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (groupId: string) => {
    if (!confirm('Delete this group? This cannot be undone.')) return
    try {
      await apiFetch(`/api/admin/groups/${groupId}`, { method: 'DELETE' })
      setGroups((prev) => prev.filter((g) => g.id !== groupId))
      toast.success('Group deleted')
    } catch (e: any) {
      toast.error(e.message || 'Failed')
    }
  }

  if (loading) return <Loading />
  if (groups.length === 0) return <Empty text="No groups yet" />

  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <div key={g.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
          <div className="h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: g.avatarColor }}>
            <Users className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{g.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {g.memberCount} members · {g.isSupergroup ? 'Supergroup' : 'Regular'}
              {g.slowModeSecs ? ` · Slow ${g.slowModeSecs}s` : ''}
              {g.allowAnonymousAdmins ? ' · Anon admins' : ''}
              {g.isChannel ? ' · Channel-mode' : ''}
            </p>
          </div>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(g.id)} title="Delete group">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// Channels Tab
// ============================================================
function ChannelsTab() {
  const [channels, setChannels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<{ channels: any[] }>('/api/admin?action=channels')
      .then((data) => setChannels(data.channels))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this channel? This cannot be undone.')) return
    try {
      await apiFetch(`/api/admin/channels/${id}`, { method: 'DELETE' })
      setChannels((prev) => prev.filter((c) => c.id !== id))
      toast.success('Channel deleted')
    } catch (e: any) {
      toast.error(e.message || 'Failed')
    }
  }

  if (loading) return <Loading />
  if (channels.length === 0) return <Empty text="No channels yet" />

  return (
    <div className="space-y-2">
      {channels.map((c) => (
        <div key={c.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
          <div className="h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: c.avatarColor }}>
            <Radio className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{c.name} <span className="text-xs text-muted-foreground">@{c.username}</span></p>
            <p className="text-xs text-muted-foreground truncate">
              {c.subscriberCount} subs · {c.postCount} posts
              {c.isPrivate ? ' · Private' : ''}
              {' · Owner: ' + (c.creator?.displayName || 'Unknown')}
            </p>
          </div>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)} title="Delete channel">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// Bots Tab
// ============================================================
function BotsTab() {
  const [bots, setBots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<{ bots: any[] }>('/api/admin?action=bots')
      .then((data) => setBots(data.bots))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bot? This cannot be undone.')) return
    try {
      await apiFetch(`/api/admin/bots/${id}`, { method: 'DELETE' })
      setBots((prev) => prev.filter((b) => b.id !== id))
      toast.success('Bot deleted')
    } catch (e: any) {
      toast.error(e.message || 'Failed')
    }
  }

  if (loading) return <Loading />
  if (bots.length === 0) return <Empty text="No bots yet" />

  return (
    <div className="space-y-2">
      {bots.map((b) => (
        <div key={b.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
          <div className="h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: b.avatarColor }}>
            <Bot className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{b.displayName} <span className="text-xs text-muted-foreground">@{b.username}</span></p>
            <p className="text-xs text-muted-foreground truncate">
              {b.description || 'No description'}
              {b.webhookUrl ? ' · Webhook set' : ''}
              {' · Owner: ' + (b.owner?.displayName || 'Unknown')}
            </p>
          </div>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(b.id)} title="Delete bot">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// Stories Tab
// ============================================================
function StoriesTab() {
  const [stories, setStories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<{ stories: any[] }>('/api/admin?action=stories')
      .then((data) => setStories(data.stories))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/admin/stories/${id}`, { method: 'DELETE' })
      setStories((prev) => prev.filter((s) => s.id !== id))
      toast.success('Story deleted')
    } catch (e: any) {
      toast.error(e.message || 'Failed')
    }
  }

  if (loading) return <Loading />
  if (stories.length === 0) return <Empty text="No stories yet" />

  return (
    <div className="space-y-2">
      {stories.map((s) => (
        <div key={s.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
          <Avatar name={s.user.displayName} color={s.user.avatarColor} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {s.user.displayName} <span className="text-xs text-muted-foreground">@{s.user.username}</span>
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {s.type === 'text' ? `📝 "${s.text}"` : '🖼️ Image'}
              {' · ' + s.viewerCount + ' views'}
              {' · ' + formatLastSeen(s.createdAt)}
            </p>
          </div>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(s.id)} title="Delete story">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}

function Loading() {
  return (
    <div className="flex items-center justify-center h-32">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-32 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
