'use client'

import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/chat-utils'

interface AvatarProps {
  name: string
  color?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  online?: boolean
  className?: string
  src?: string
}

const sizeMap = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-20 w-20 text-2xl',
}

const dotSizeMap = {
  sm: 'h-2.5 w-2.5',
  md: 'h-3 w-3',
  lg: 'h-3.5 w-3.5',
  xl: 'h-5 w-5',
}

export function Avatar({
  name,
  color = '#6366f1',
  size = 'md',
  online,
  className,
  src,
}: AvatarProps) {
  return (
    <div className={cn('relative inline-flex shrink-0', className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className={cn(
            'rounded-full object-cover ring-2 ring-background',
            sizeMap[size]
          )}
        />
      ) : (
        <div
          className={cn(
            'flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-background overflow-hidden',
            sizeMap[size]
          )}
          style={{
            background: `linear-gradient(135deg, ${color} 0%, ${shadeColor(color, -25)} 100%)`,
          }}
        >
          {getInitials(name)}
        </div>
      )}
      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-background',
            dotSizeMap[size],
            online ? 'bg-green-500' : 'bg-muted-foreground/60'
          )}
        />
      )}
    </div>
  )
}

function shadeColor(color: string, percent: number): string {
  let R = parseInt(color.substring(1, 3), 16)
  let G = parseInt(color.substring(3, 5), 16)
  let B = parseInt(color.substring(5, 7), 16)
  R = Math.max(0, Math.min(255, R + (R * percent) / 100))
  G = Math.max(0, Math.min(255, G + (G * percent) / 100))
  B = Math.max(0, Math.min(255, B + (B * percent) / 100))
  return `#${Math.round(R).toString(16).padStart(2, '0')}${Math.round(G).toString(16).padStart(2, '0')}${Math.round(B).toString(16).padStart(2, '0')}`
}
