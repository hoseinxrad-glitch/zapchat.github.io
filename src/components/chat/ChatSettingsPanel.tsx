'use client'

import { useState, useEffect } from 'react'
import { Loader2, Save, Clock, Bell, Archive, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { useChatStore } from '@/lib/chat-store'
import { apiFetch } from '@/lib/chat-utils'
import { toast } from 'sonner'

const AUTO_DELETE_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '24 hours', value: 86400 },
  { label: '7 days', value: 604800 },
  { label: '1 month', value: 2592000 },
]

interface ChatSettingsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chatId?: string | null
  groupId?: string | null
}

export function ChatSettingsPanel({ open, onOpenChange, chatId, groupId }: ChatSettingsPanelProps) {
  const currentUser = useChatStore((s) => s.currentUser)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [archived, setArchived] = useState(false)
  const [muted, setMuted] = useState(false)
  const [autoDeleteSecs, setAutoDeleteSecs] = useState(0)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const endpoint = groupId
      ? `/api/chat-settings?groupId=${groupId}`
      : `/api/chat-settings?chatId=${chatId}`
    apiFetch<{ settings: any }>(endpoint)
      .then((data) => {
        if (data.settings) {
          setArchived(data.settings.archived || false)
          setMuted(data.settings.muted || false)
          setAutoDeleteSecs(data.settings.autoDeleteSecs || 0)
        } else {
          setArchived(false); setMuted(false); setAutoDeleteSecs(0)
        }
      })
      .catch(() => {
        setArchived(false); setMuted(false); setAutoDeleteSecs(0)
      })
      .finally(() => setLoading(false))
  }, [open, chatId, groupId])

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiFetch('/api/chat-settings', {
        method: 'PATCH',
        body: JSON.stringify({
          chatId, groupId,
          archived, muted, autoDeleteSecs,
        }),
      })
      toast.success('Settings saved')
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const convName = groupId ? 'group' : 'chat'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 gap-0 overflow-hidden">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Chat Settings
          </SheetTitle>
          <SheetDescription className="sr-only">Per-user settings for this {convName}</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-4rem)] scrollbar-thin">
            <div className="p-5 space-y-5">
              {/* Notifications */}
              <div className="space-y-3">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Notifications</h3>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    <div>
                      <Label htmlFor="cs-muted">Mute {convName}</Label>
                      <p className="text-xs text-muted-foreground">You won't receive notifications for new messages.</p>
                    </div>
                  </div>
                  <Switch id="cs-muted" checked={muted} onCheckedChange={setMuted} />
                </div>
              </div>

              {/* Organization */}
              <div className="space-y-3 pt-4 border-t border-border">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Organization</h3>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Archive className="h-4 w-4 text-primary" />
                    <div>
                      <Label htmlFor="cs-archived">Archive</Label>
                      <p className="text-xs text-muted-foreground">Hide this {convName} from your main chat list.</p>
                    </div>
                  </div>
                  <Switch id="cs-archived" checked={archived} onCheckedChange={setArchived} />
                </div>
              </div>

              {/* Auto-delete */}
              <div className="space-y-3 pt-4 border-t border-border">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Auto-Delete</h3>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Auto-delete messages after
                  </Label>
                  <Select value={autoDeleteSecs.toString()} onValueChange={(v) => setAutoDeleteSecs(parseInt(v, 10))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUTO_DELETE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value.toString()}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Messages older than this will be automatically deleted.
                  </p>
                </div>
              </div>

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
