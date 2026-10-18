'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Users, Plus, UserMinus, Crown, LogOut, Trash2, Search, Shield, Settings } from 'lucide-react'
import { Avatar } from './Avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { useChatStore, type GroupInfo, type ChatUser } from '@/lib/chat-store'
import { apiFetch, formatLastSeen } from '@/lib/chat-utils'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface GroupInfoPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string | null
}

export function GroupInfoPanel({ open, onOpenChange, groupId }: GroupInfoPanelProps) {
  const currentUser = useChatStore((s) => s.currentUser)
  const onlineUsers = useChatStore((s) => s.onlineUsers)
  const upsertGroup = useChatStore((s) => s.upsertGroup)
  const removeGroup = useChatStore((s) => s.removeGroup)
  const setActiveConversation = useChatStore((s) => s.setActiveConversation)
  const setShowGroupInfoPanel = useChatStore((s) => s.setShowGroupInfoPanel)

  const [group, setGroup] = useState<GroupInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!open || !groupId) return
    setLoading(true)
    apiFetch<{ group: GroupInfo }>(`/api/groups/${groupId}`)
      .then((data) => {
        setGroup(data.group)
        upsertGroup(data.group)
      })
      .catch((e) => {
        toast.error(e.message || 'Failed to load group')
        onOpenChange(false)
      })
      .finally(() => setLoading(false))
  }, [open, groupId, upsertGroup])

  if (!group) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md p-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
            <SheetTitle>Group info</SheetTitle>
          </SheetHeader>
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  const isAdmin = group.members.find((m) => m.user.id === currentUser?.id)?.role === 'admin'
  const isCreator = group.creatorId === currentUser?.id

  const handleRemoveMember = async (userId: string) => {
    if (!confirm(`Remove this member from the group?`)) return
    setActionLoading(true)
    try {
      await apiFetch(`/api/groups/${group.id}/members?userId=${userId}`, { method: 'DELETE' })
      const updated = {
        ...group,
        members: group.members.filter((m) => m.user.id !== userId),
      }
      setGroup(updated)
      upsertGroup(updated)
      toast.success('Member removed')
    } catch (e: any) {
      toast.error(e.message || 'Failed to remove member')
    } finally {
      setActionLoading(false)
    }
  }

  const handleLeaveGroup = async () => {
    setActionLoading(true)
    try {
      await apiFetch(`/api/groups/${group.id}?action=leave`, { method: 'DELETE' })
      removeGroup(group.id)
      setActiveConversation(null)
      setShowGroupInfoPanel(false)
      toast.success('Left the group')
    } catch (e: any) {
      toast.error(e.message || 'Failed to leave group')
    } finally {
      setActionLoading(false)
      setConfirmLeave(false)
    }
  }

  const handleDeleteGroup = async () => {
    setActionLoading(true)
    try {
      await apiFetch(`/api/groups/${group.id}`, { method: 'DELETE' })
      removeGroup(group.id)
      setActiveConversation(null)
      setShowGroupInfoPanel(false)
      toast.success('Group deleted')
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete group')
    } finally {
      setActionLoading(false)
      setConfirmDelete(false)
    }
  }

  const handleMemberAdded = (newMember: any) => {
    if (!group) return
    const updated = {
      ...group,
      members: [...group.members, newMember],
    }
    setGroup(updated)
    upsertGroup(updated)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md p-0 gap-0 overflow-hidden">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Group info
            </SheetTitle>
            <SheetDescription className="sr-only">View group details and members</SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-4rem)] scrollbar-thin">
            <div className="p-6 space-y-6">
              {/* Group identity */}
              <div className="flex flex-col items-center text-center">
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-2xl text-white shadow-lg shadow-primary/20"
                  style={{ background: group.avatarColor }}
                >
                  <Users className="h-10 w-10" />
                </div>
                <h2 className="text-xl font-bold mt-3">{group.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {group.members.length} member{group.members.length === 1 ? '' : 's'}
                </p>
                {group.description && (
                  <p className="text-sm text-muted-foreground mt-2 italic">&ldquo;{group.description}&rdquo;</p>
                )}
              </div>

              {/* Members list */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                    Members ({group.members.length})
                  </h3>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={group.members.length >= 10}
                      onClick={() => setShowAddMember(true)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </Button>
                  )}
                </div>

                <div className="space-y-1">
                  {group.members.map((m) => {
                    const isOnline = onlineUsers.some((u) => u.userId === m.user.id)
                    const isMe = m.user.id === currentUser?.id
                    return (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent/40 transition-colors"
                      >
                        <Avatar
                          name={m.user.displayName}
                          color={m.user.avatarColor}
                          size="md"
                          online={isOnline}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold truncate">
                              {m.user.displayName}
                              {isMe && <span className="text-xs text-muted-foreground font-normal"> (you)</span>}
                            </p>
                            {m.role === 'admin' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-primary/15 text-primary">
                                <Shield className="h-2.5 w-2.5" />
                                Admin
                              </span>
                            )}
                            {m.user.id === group.creatorId && (
                              <Crown className="h-3.5 w-3.5 text-yellow-500" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            @{m.user.username} · {isOnline ? 'online' : formatLastSeen(m.user.lastSeen)}
                          </p>
                        </div>
                        {isAdmin && !isMe && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                            disabled={actionLoading}
                            onClick={() => handleRemoveMember(m.user.id)}
                            title="Remove member"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-4 border-t border-border">
                {isAdmin && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      // Open settings via the admin button in the parent
                      const event = new CustomEvent('openGroupSettings', { detail: group.id })
                      window.dispatchEvent(event)
                    }}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Open settings
                  </Button>
                )}
                {!isCreator && (
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={actionLoading}
                    onClick={() => setConfirmLeave(true)}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Leave group
                  </Button>
                )}
                {isCreator && (
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={actionLoading}
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete group
                  </Button>
                )}
              </div>

              <p className="text-xs text-muted-foreground text-center pt-2">
                Group created {formatLastSeen(group.createdAt)}
              </p>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Add member dialog */}
      <AddMemberDialog
        open={showAddMember}
        onOpenChange={setShowAddMember}
        group={group}
        onAdded={handleMemberAdded}
      />

      {/* Confirm leave */}
      <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave &ldquo;{group.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              You will no longer receive messages from this group. You can be re-added later if an admin invites you.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setConfirmLeave(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleLeaveGroup} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Leave group'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{group.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. All messages will be permanently deleted for everyone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteGroup} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete permanently'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ============================================================
// AddMemberDialog
// ============================================================
function AddMemberDialog({
  open,
  onOpenChange,
  group,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: GroupInfo
  onAdded: (member: any) => void
}) {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<ChatUser[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const existingMemberIds = new Set(group.members.map((m) => m.user.id))

  useEffect(() => {
    if (open) {
      setQuery('')
      loadUsers('')
    }
  }, [open])

  const loadUsers = async (q: string) => {
    setLoading(true)
    try {
      const endpoint = q.trim() ? `/api/users?action=search&q=${encodeURIComponent(q)}` : `/api/users?action=all`
      const data = await apiFetch<{ users: ChatUser[] }>(endpoint)
      // Filter out existing members
      setUsers(data.users.filter((u) => !existingMemberIds.has(u.id)))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (user: ChatUser) => {
    setAdding(user.id)
    try {
      const data = await apiFetch<{ member: any }>(`/api/groups/${group.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: user.id }),
      })
      onAdded(data.member)
      toast.success(`${user.displayName} added to the group`)

      // Notify via WebSocket
      const socket = (window as any).__zapchat_socket
      if (socket) {
        socket.emit('group:event', {
          type: 'member-added',
          groupId: group.id,
          memberIds: group.members.map((m) => m.user.id),
          payload: { member: data.member },
        })
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to add member')
    } finally {
      setAdding(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add member
          </DialogTitle>
          <DialogDescription>
            Add a user to &ldquo;{group.name}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                const v = e.target.value
                if (window) {
                  clearTimeout((window as any).__searchTimeout)
                  ;(window as any).__searchTimeout = setTimeout(() => loadUsers(v), 300)
                }
              }}
              placeholder="Search by @username or name..."
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        <ScrollArea className="max-h-80 h-80 scrollbar-thin">
          {loading && users.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center px-6">
              <p className="text-sm font-medium mb-1">No users available</p>
              <p className="text-xs text-muted-foreground">
                {query ? 'Try a different search.' : 'All users are already in this group.'}
              </p>
            </div>
          ) : (
            <div className="p-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-colors"
                >
                  <Avatar name={user.displayName} color={user.avatarColor} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{user.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={adding === user.id}
                    onClick={() => handleAdd(user)}
                    className="h-8"
                  >
                    {adding === user.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
