'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, User, Lock, AtSign, ArrowRight, Loader2, Sparkles, Shield, Github } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch, setToken, setStoredUser, type AuthUser } from '@/lib/chat-utils'
import { useChatStore } from '@/lib/chat-store'
import { toast } from 'sonner'

const avatarColors = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6',
]

export function AuthScreen() {
  const setAuthLoading = useChatStore((s) => s.setAuthLoading)
  const setCurrentUser = useChatStore((s) => s.setCurrentUser)
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    username: '',
    displayName: '',
    password: '',
    bio: '',
    avatarColor: avatarColors[0],
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const endpoint = `/api/auth?action=${mode}`
      const body =
        mode === 'register'
          ? {
              username: form.username,
              displayName: form.displayName || form.username,
              password: form.password,
              bio: form.bio,
              avatarColor: form.avatarColor,
            }
          : {
              username: form.username,
              password: form.password,
            }

      const data = await apiFetch<{ token: string; user: AuthUser }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      })

      setToken(data.token)
      setStoredUser(data.user)
      setCurrentUser(data.user)
      setAuthLoading(false)
      toast.success(mode === 'register' ? 'Welcome to ZapChat!' : 'Welcome back!')
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-accent/30">
      {/* Animated background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Brand */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-xl shadow-primary/30 mb-4"
          >
            <Zap className="h-8 w-8" fill="currentColor" />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight">ZapChat</h1>
          <p className="text-muted-foreground mt-1">Fast. Private. Open-source.</p>
        </div>

        {/* Card */}
        <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-6 sm:p-8">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg mb-6">
            {(['register', 'login'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`relative py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === m ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode === m && (
                  <motion.div
                    layoutId="auth-tab"
                    className="absolute inset-0 bg-primary rounded-md shadow"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative z-10">
                  {m === 'register' ? 'Sign up' : 'Log in'}
                </span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {mode === 'register' && (
                <motion.div
                  key="register-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="displayName"
                        value={form.displayName}
                        onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                        placeholder="Jane Doe"
                        className="pl-9"
                        autoComplete="name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio (optional)</Label>
                    <Input
                      id="bio"
                      value={form.bio}
                      onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                      placeholder="Hey there! I'm using ZapChat."
                      maxLength={200}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Avatar color</Label>
                    <div className="flex gap-2 flex-wrap">
                      {avatarColors.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, avatarColor: c }))}
                          className={`h-8 w-8 rounded-full transition-all ${
                            form.avatarColor === c ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110' : 'hover:scale-110'
                          }`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                  placeholder="cool_user"
                  className="pl-9"
                  required
                  minLength={3}
                  autoComplete="username"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                No phone number needed. Ever.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="pl-9"
                  required
                  minLength={6}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 text-base shadow-lg shadow-primary/30"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {mode === 'register' ? 'Create account' : 'Log in'}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center text-xs text-muted-foreground">
            <p className="flex items-center justify-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              End-to-end encrypted by default
            </p>
          </div>
        </div>

        {/* Feature badges */}
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            No phone needed
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            E2E encrypted
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Github className="h-3.5 w-3.5" />
            Open source
          </a>
        </div>
      </motion.div>
    </div>
  )
}
