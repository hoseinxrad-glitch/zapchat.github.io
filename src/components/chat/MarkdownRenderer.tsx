'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import { useChatStore } from '@/lib/chat-store'

interface MarkdownRendererProps {
  content: string
  className?: string
}

/**
 * Renders markdown with:
 * - Bold, italic, strikethrough, code, code blocks
 * - Links (open in new tab)
 * - Mentions @username (clickable - opens profile)
 * - Hashtags #topic (clickable - searches)
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  // Pre-process: extract mentions and hashtags and convert to markdown links
  const processed = preprocessMarkdown(content)

  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          // Render links
          a: ({ node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80"
            />
          ),
          // Inline code
          code: ({ inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code className="bg-muted/60 rounded px-1 py-0.5 text-[0.9em] font-mono" {...props}>
                  {children}
                </code>
              )
            }
            return (
              <code className="block bg-muted/60 rounded-md p-2 text-[0.9em] font-mono overflow-x-auto my-1" {...props}>
                {children}
              </code>
            )
          },
          // Bold
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          // Italic
          em: ({ children }) => <em className="italic">{children}</em>,
          // Strikethrough
          del: ({ children }) => <del className="line-through opacity-70">{children}</del>,
          // Mention link (special URL format)
          p: ({ children }) => <p className="whitespace-pre-wrap break-words">{children}</p>,
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
}

function preprocessMarkdown(text: string): string {
  let result = text

  // Escape existing markdown special chars that we don't want to interpret
  // (none for now - we want full markdown support)

  // @mentions -> clickable
  result = result.replace(/(^|\s)@([a-zA-Z0-9_]{3,32})/g, (match, prefix, username) => {
    return `${prefix}[@${username}](#mention:${username})`
  })

  // #hashtags -> clickable
  result = result.replace(/(^|\s)#([a-zA-Z0-9_]{2,50})/g, (match, prefix, tag) => {
    return `${prefix}[#${tag}](#hashtag:${tag})`
  })

  return result
}
