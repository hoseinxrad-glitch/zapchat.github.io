'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Save, Zap, Shield, AtSign } from 'lucide-react'
import { Avatar } from './Avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { useChatStore } from '@/lib/chat-store'
import { apiFetch, formatLastSeen, type AuthUser } from '@/lib/chat-utils'
import { toast } from 'sonner'

const avatarColors = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6',
]

interface ProfilePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // If viewing another user's profile
  viewUserId?: string | null
}

export function ProfilePanel({ open, onOpenChange, viewUserId }: ProfilePanelProps) {
  const currentUser = useChatStore((s) => s.currentUser)
  const setCurrentUser = useChatStore((s) => s.setCurrentUser)
  const onlineUsers = useChatStore((s) => s.onlineUsers)

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarColor, setAvatarColor] = useState('#6366f1')
  const [saving, setSaving] = useState(false)
  const [viewedUser, setViewedUser] = useState<any>(null)
  const [loadingViewed, setLoadingViewed] = useState(false)

  const isViewingOther = !!viewUserId

  useEffect(() => {
    if (!open) return
    if (viewUserId) {
      // Load other user's profile
      setLoadingViewed(true)
      apiFetch<{ users: any[] }>(`/api/users?action=all`)
        .then((data) => {
          const u = data.users.find((x) => x.id === viewUserId)
          setViewedUser(u || null)
        })
        .catch(() => setViewedUser(null))
        .finally(() => setLoadingViewed(false))
    } else if (currentUser) {
      setDisplayName(currentUser.displayName)
      setBio(currentUser.bio)
      setAvatarColor(currentUser.avatarColor)
    }
  }, [open, viewUserId, currentUser])

  if (isViewingOther) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md p-0 gap-0 overflow-hidden">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
            <SheetTitle>User profile</SheetTitle>
            <SheetDescription className="sr-only">View user information</SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-4rem)] scrollbar-thin">
            {loadingViewed ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : viewedUser ? (
              <div className="p-6 space-y-6">
                <div className="flex flex-col items-center text-center">
                  <Avatar
                    name={viewedUser.displayName}
                    color={viewedUser.avatarColor}
                    size="xl"
                    online={onlineUsers.some((u) => u.userId === viewedUser.id)}
                  />
                  <h2 className="text-xl font-bold mt-3">{viewedUser.displayName}</h2>
                  <p className="text-sm text-muted-foreground">@{viewedUser.username}</p>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {onlineUsers.some((u) => u.userId === viewedUser.id) ? (
                      <span className="text-green-500">● online now</span>
                    ) : (
                      <span>last seen {formatLastSeen(viewedUser.lastSeen)}</span>
                    )}
                  </div>
                </div>

                {viewedUser.bio && (
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">About</h3>
                    <p className="text-sm">{viewedUser.bio}</p>
                  </div>
                )}

                <div className="space-y-2 pt-4 border-t border-border">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <AtSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Username</p>
                      <p className="text-sm font-medium">@{viewedUser.username}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <p className="text-sm text-muted-foreground">User not found</p>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    )
  }

  if (!currentUser) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 gap-0 overflow-hidden">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" fill="currentColor" />
            My profile
          </SheetTitle>
          <SheetDescription className="sr-only">Edit your profile</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-4rem)] scrollbar-thin">
          <div className="p-6 space-y-6">
            {/* Avatar preview */}
            <div className="flex flex-col items-center text-center">
              <Avatar
                name={displayName || currentUser.displayName}
                color={avatarColor}
                size="xl"
                online
              />
              <h2 className="text-xl font-bold mt-3">{displayName || currentUser.displayName}</h2>
              <p className="text-sm text-muted-foreground">@{currentUser.username}</p>
            </div>

            {/* Edit form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={200}
                  rows={3}
                  placeholder="Tell something about yourself..."
                />
                <p className="text-xs text-muted-foreground text-right">{bio.length}/200</p>
              </div>

              <div className="space-y-2">
                <Label>Avatar color</Label>
                <div className="flex gap-2 flex-wrap">
                  {avatarColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAvatarColor(c)}
                      className={`h-9 w-9 rounded-full transition-all ${
                        avatarColor === c ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110' : 'hover:scale-110'
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              <Button
                onClick={async () => {
                  setSaving(true)
                  try {
                    const data = await apiFetch<{ user: AuthUser }>('/api/users', {
                      method: 'PATCH',
                      body: JSON.stringify({
                        displayName, bio, avatarColor,
                      }),
                    })
                    setCurrentUser(data.user)
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('zapchat_user', JSON.stringify(data.user))
                    }
                    toast.success('Profile updated')
                  } catch (e: any) {
                    toast.error(e.message || 'Update failed')
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
                className="w-full h-11"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save changes
              </Button>
            </div>

            {/* About ZapChat */}
            <div className="space-y-3 pt-6 border-t border-border">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">About ZapChat</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Shield className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Privacy</p>
                    <p className="text-sm font-medium">No phone number required</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Zap className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Performance</p>
                    <p className="text-sm font-medium">Real-time WebSocket messaging</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center pt-2">
                ZapChat v1.0 · Open source
              </p>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
