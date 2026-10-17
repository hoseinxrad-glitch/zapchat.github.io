'use client'

import { useState } from 'react'
import { Bot, Loader2, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { useExtendedStore } from '@/lib/extended-store'
import { apiFetch } from '@/lib/chat-utils'
import { toast } from 'sonner'

const COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b']

export function CreateBotModal({ open, onOpenChange }: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [avatarColor, setAvatarColor] = useState(COLORS[0])
  const [webhookUrl, setWebhookUrl] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdBot, setCreatedBot] = useState<{ token: string; username: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const setMyBots = useExtendedStore((s) => s.setMyBots)
  const myBots = useExtendedStore((s) => s.myBots)

  const handleCreate = async () => {
    if (!username.trim() || !displayName.trim()) {
      toast.error('Username and display name are required')
      return
    }
    setCreating(true)
    try {
      const data = await apiFetch<{ bot: any }>('/api/bots', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          displayName: displayName.trim(),
          description,
          avatarColor,
          webhookUrl: webhookUrl.trim() || undefined,
        }),
      })
      setMyBots([...myBots, data.bot])
      setCreatedBot({ token: data.bot.token, username: data.bot.username })
      toast.success(`Bot @${data.bot.username} created!`)
      // Reset form but don't close (show token)
      setUsername('')
      setDisplayName('')
      setDescription('')
      setWebhookUrl('')
    } catch (e: any) {
      toast.error(e.message || 'Failed to create bot')
    } finally {
      setCreating(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setCreatedBot(null)
    setCopied(false)
  }

  const copyToken = () => {
    if (createdBot) {
      navigator.clipboard?.writeText(createdBot.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            {createdBot ? 'Bot Created!' : 'Create a Bot'}
          </DialogTitle>
          <DialogDescription>
            {createdBot
              ? 'Save your bot token securely. You will not see it again.'
              : 'Bots can respond to messages and commands automatically.'}
          </DialogDescription>
        </DialogHeader>

        {createdBot ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-400 mb-3">
                ✅ Your bot <code className="font-mono">@{createdBot.username}</code> has been created!
              </p>
              <Label>Bot Token (save this!)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  readOnly
                  value={createdBot.token}
                  className="font-mono text-xs"
                />
                <Button size="icon" onClick={copyToken} title="Copy token">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>📍 To receive messages, set up a webhook:</p>
              <code className="block bg-muted p-2 rounded font-mono">
                POST https://your-server.com/webhook
                <br />Body: {'{ "message": "...", "from": "..." }'}
                <br />Header: Authorization: Bearer {`{TOKEN}`}
              </code>
            </div>
            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center pb-2">
              <div
                className="h-20 w-20 rounded-full flex items-center justify-center text-white shadow-lg"
                style={{ background: avatarColor }}
              >
                <Bot className="h-10 w-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bot-username">Bot username *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                <Input
                  id="bot-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="my_bot"
                  maxLength={32}
                  className="pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Will be saved with <code>_bot</code> suffix if not already.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bot-name">Display name *</Label>
              <Input
                id="bot-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="My Cool Bot"
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bot-desc">Description (optional)</Label>
              <Textarea
                id="bot-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this bot do?"
                maxLength={200}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Bot color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
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

            <div className="space-y-2">
              <Label htmlFor="bot-webhook">Webhook URL (optional)</Label>
              <Input
                id="bot-webhook"
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-server.com/webhook"
              />
              <p className="text-xs text-muted-foreground">
                Messages sent to this bot will be forwarded to this URL.
              </p>
            </div>

            <Button
              className="w-full"
              disabled={creating}
              onClick={handleCreate}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create bot'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
