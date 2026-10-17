'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, Send, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/chat-utils'

interface VoiceRecorderProps {
  onSend: (audioData: { fileUrl: string; fileName: string; fileSize: number; duration: number; waveform: number[] }) => void
}

export function VoiceRecorder({ onSend }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [duration, setDuration] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const waveformRef = useRef<number[]>([])
  const animFrameRef = useRef<number | null>(null)

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      waveformRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await uploadAndSend(blob)
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }

      recorder.start()
      setIsRecording(true)
      setDuration(0)

      // Setup analyser for waveform
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      // Sample waveform every 100ms
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const sampleAmplitude = () => {
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        waveformRef.current.push(Math.min(1, avg / 128))
        animFrameRef.current = window.setTimeout(sampleAmplitude, 100)
      }
      sampleAmplitude()

      // Duration counter
      timerRef.current = setInterval(() => {
        setDuration((d) => {
          if (d >= 300) { // 5 min max
            stopRecording()
            return d
          }
          return d + 1
        })
      }, 1000)
    } catch (e: any) {
      toast.error('Microphone access denied')
      console.error(e)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) clearInterval(timerRef.current)
    if (animFrameRef.current) clearTimeout(animFrameRef.current)
    setIsRecording(false)
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null // prevent upload
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) clearInterval(timerRef.current)
    if (animFrameRef.current) clearTimeout(animFrameRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setIsRecording(false)
    setDuration(0)
    chunksRef.current = []
    waveformRef.current = []
  }

  const uploadAndSend = async (blob: Blob) => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
      formData.append('file', file)
      const res = await apiFetch<{ url: string; fileName: string; fileSize: number }>('/api/upload', {
        method: 'POST',
        body: formData,
      })
      onSend({
        fileUrl: res.url,
        fileName: res.fileName,
        fileSize: res.fileSize,
        duration,
        waveform: waveformRef.current,
      })
    } catch (e: any) {
      toast.error('Voice upload failed')
    } finally {
      setIsUploading(false)
      setDuration(0)
      waveformRef.current = []
    }
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-destructive"
          onClick={cancelRecording}
          title="Cancel"
        >
          <X className="h-5 w-5" />
        </Button>
        <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-destructive/10 rounded-full">
          <span className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm font-mono">
            {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
          </span>
          {/* Waveform preview */}
          <div className="flex-1 flex items-center gap-0.5 h-6">
            {waveformRef.current.slice(-30).map((amp, i) => (
              <div
                key={i}
                className="w-0.5 bg-destructive/70 rounded"
                style={{ height: `${Math.max(10, amp * 100)}%` }}
              />
            ))}
          </div>
        </div>
        <Button
          variant="default"
          size="icon"
          className="rounded-full bg-primary"
          onClick={stopRecording}
          title="Send voice message"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    )
  }

  if (isUploading) {
    return (
      <Button variant="ghost" size="icon" className="rounded-full" disabled>
        <Loader2 className="h-5 w-5 animate-spin" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full"
      onClick={startRecording}
      title="Record voice message"
    >
      <Mic className="h-5 w-5" />
    </Button>
  )
}
