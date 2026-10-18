'use client'

import { useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Loader2, User } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Avatar } from './Avatar'
import { useExtendedStore, type CallState } from '@/lib/extended-store'

interface CallPanelProps {
  call: CallState
  onEnd: () => void
}

export function CallPanel({ call, onEnd }: CallPanelProps) {
  const [isMuted, setIsMuted] = useState(false)
  const localAudioRef = useRef<HTMLAudioElement | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const socket = (typeof window !== 'undefined' ? (window as any).__zapchat_socket : null) as any
  const currentUser = useExtendedStore.getState

  useEffect(() => {
    let mounted = true

    const setupCall = async () => {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        })
        if (!mounted) { pc.close(); return }
        pcRef.current = pc

        // Get local stream
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: call.callType === 'video',
        })
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop())
          pc.close()
          return
        }

        // Add tracks
        stream.getTracks().forEach((t) => pc.addTrack(t, stream))

        // Setup remote stream
        const remoteStream = new MediaStream()
        pc.ontrack = (event) => {
          event.streams[0].getTracks().forEach((t) => remoteStream.addTrack(t))
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream
          }
        }

        // ICE candidate exchange
        pc.onicecandidate = (event) => {
          if (event.candidate && socket) {
            socket.emit('call:ice', {
              callId: call.callId,
              targetUserId: call.otherUserId,
              candidate: event.candidate,
            })
          }
        }

        // If we're the caller, send offer
        if (call.direction === 'outgoing') {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          if (socket) {
            socket.emit('call:sdp:offer', {
              callId: call.callId,
              receiverId: call.otherUserId,
              sdp: offer,
            })
          }
        }

        // Wire up WS listeners
        if (socket) {
          socket.on('call:sdp:offer', async (data: any) => {
            if (data.callId !== call.callId) return
            await pc.setRemoteDescription(data.sdp)
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            socket.emit('call:sdp:answer', {
              callId: call.callId,
              callerId: call.otherUserId,
              sdp: answer,
            })
          })

          socket.on('call:sdp:answer', async (data: any) => {
            if (data.callId !== call.callId) return
            await pc.setRemoteDescription(data.sdp)
          })

          socket.on('call:ice', async (data: any) => {
            if (data.callId !== call.callId) return
            if (data.candidate) {
              try {
                await pc.addIceCandidate(data.candidate)
              } catch {}
            }
          })

          socket.on('call:ended', (data: any) => {
            if (data.callId !== call.callId) return
            onEnd()
          })
        }
      } catch (e) {
        console.error('Call setup failed', e)
        onEnd()
      }
    }

    setupCall()

    return () => {
      mounted = false
      if (pcRef.current) pcRef.current.close()
      if (socket) {
        socket.off('call:sdp:offer')
        socket.off('call:sdp:answer')
        socket.off('call:ice')
        socket.off('call:ended')
      }
    }
  }, [call.callId])

  const toggleMute = () => {
    if (pcRef.current) {
      const senders = pcRef.current.getSenders()
      const audioSender = senders.find((s) => s.track?.kind === 'audio')
      if (audioSender?.track) {
        audioSender.track.enabled = isMuted
        setIsMuted(!isMuted)
      }
    }
  }

  const handleEnd = () => {
    if (socket) {
      socket.emit('call:end', {
        callId: call.callId,
        otherUserId: call.otherUserId,
      })
    }
    onEnd()
  }

  const statusText = call.status === 'ringing'
    ? (call.direction === 'outgoing' ? 'Calling...' : 'Incoming call')
    : call.status === 'connecting'
    ? 'Connecting...'
    : call.status === 'connected'
    ? 'Connected'
    : 'Ended'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl p-6"
    >
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      <Avatar
        name={call.otherUserName}
        color={call.otherUserAvatarColor}
        size="xl"
        className="mb-6"
      />

      <h2 className="text-2xl font-bold text-white mb-1">{call.otherUserName}</h2>
      <p className="text-white/60 mb-8">
        {call.callType === 'video' ? 'Video call' : 'Voice call'} · {statusText}
      </p>

      <div className="flex items-center gap-4">
        <Button
          variant="secondary"
          size="icon"
          className="h-14 w-14 rounded-full"
          onClick={toggleMute}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>

        <Button
          variant="destructive"
          size="icon"
          className="h-16 w-16 rounded-full"
          onClick={handleEnd}
        >
          <PhoneOff className="h-7 w-7" />
        </Button>
      </div>

      {/* Hidden audio element for our own audio monitor (optional) */}
      <audio ref={localAudioRef} muted className="hidden" />
    </motion.div>
  )
}
