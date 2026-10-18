'use client'

import { useState, useEffect } from 'react'
import { Loader2, Save, Gauge, Eye, Rocket, Users, Crown, Shield, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { useChatStore, type GroupInfo } from '@/lib/chat-store'
import { apiFetch } from '@/lib/chat-utils'
import { toast } from 'sonner'

const SLOW_MODE_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '10 seconds', value: 10 },
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
  { label: '15 minutes', value: 900 },
  { label: '1 hour', value: 3600 },
]

interface GroupSettingsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string | null
}

export function GroupSettingsPanel({ open, onOpenChange, groupId }: GroupSettingsPanelProps) {
  const currentUser = useChatStore((s) => s.currentUser)
  const groups = useChatStore((s) => s.groups)
  const upsertGroup = useChatStore((s) => s.upsertGroup)

  const [group, setGroup] = useState<GroupInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [avatarColor, setAvatarColor] = useState('#8b5cf6')
  const [slowModeSecs, setSlowModeSecs] = useState(0)
  const [allowAnonymousAdmins, setAllowAnonymousAdmins] = useState(false)
  const [isSupergroup, setIsSupergroup] = useState(false)

  useEffect(() => {
    if (!open || !groupId) return
    setLoading(true)
    apiFetch<{ group: GroupInfo }>(`/api/groups/${groupId}`)
      .then((data) => {
        setGroup(data.group)
        upsertGroup(data.group)
        setName(data.group.name)
        setDescription(data.group.description)
        setAvatarColor(data.group.avatarColor)
        setSlowModeSecs((data.group as any).slowModeSecs || 0)
        setAllowAnonymousAdmins((data.group as any).allowAnonymousAdmins || false)
        setIsSupergroup((data.group as any).isSupergroup || false)
      })
      .catch((e) => toast.error(e.message || 'Failed to load group'))
      .finally(() => setLoading(false))
  }, [open, groupId, upsertGroup])

  if (!group) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md p-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
            <SheetTitle>Group settings</SheetTitle>
          </SheetHeader>
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  const isAdmin = (group as any).members?.find((m: any) => m.user.id === currentUser?.id)?.role === 'admin' || group.creatorId === currentUser?.id

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = await apiFetch<{ group: any }>(`/api/groups/${groupId}?action=settings`, {
        method: 'PATCH',
        body: JSON.stringify({
          name, description, avatarColor,
          slowModeSecs, allowAnonymousAdmins, isSupergroup,
        }),
      })
      upsertGroup({ ...group, ...data.group, members: group.members })
      toast.success('Settings saved')
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 gap-0 overflow-hidden">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Group Settings
          </SheetTitle>
          <SheetDescription className="sr-only">Edit group settings</SheetDescription>
        </SheetHeader>

        {!isAdmin ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Only admins can edit group settings.
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-4rem)] scrollbar-thin">
            <div className="p-5 space-y-5">
              {/* Basic info */}
              <div className="space-y-3">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Basic Info</h3>
                <div className="space-y-2">
                  <Label htmlFor="g-name">Group name</Label>
                  <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="g-desc">Description</Label>
                  <Textarea id="g-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#14b8a6', '#6366f1'].map((c) => (
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
              </div>

              {/* Group type */}
              <div className="space-y-3 pt-4 border-t border-border">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Group Type</h3>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Rocket className="h-4 w-4 text-primary" />
                    <div>
                      <Label htmlFor="g-super">Supergroup</Label>
                      <p className="text-xs text-muted-foreground">Allows more than 10 members.</p>
                    </div>
                  </div>
                  <Switch id="g-super" checked={isSupergroup} onCheckedChange={setIsSupergroup} />
                </div>
              </div>

              {/* Permissions */}
              <div className="space-y-3 pt-4 border-t border-border">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Permissions</h3>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" />
                    <div>
                      <Label htmlFor="g-anon">Anonymous admins</Label>
                      <p className="text-xs text-muted-foreground">Admins can post without showing their name.</p>
                    </div>
                  </div>
                  <Switch id="g-anon" checked={allowAnonymousAdmins} onCheckedChange={setAllowAnonymousAdmins} />
                </div>
              </div>

              {/* Slow mode */}
              <div className="space-y-3 pt-4 border-t border-border">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Slow Mode</h3>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-primary" />
                    Time between messages per user
                  </Label>
                  <Select value={slowModeSecs.toString()} onValueChange={(v) => setSlowModeSecs(parseInt(v, 10))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SLOW_MODE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value.toString()}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Members will have to wait this long between sending messages.
                  </p>
                </div>
              </div>

              {/* Save button */}
              <div className="pt-4 border-t border-border">
                <Button className="w-full" disabled={saving} onClick={handleSave}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save settings
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  )
}
