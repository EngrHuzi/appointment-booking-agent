'use client'

import { useEffect, useRef, useState } from 'react'
import BookingCard from './BookingCard'

interface BookingDetails {
  booking_id: string
  client_name: string
  service: string
  datetime: string
  duration_minutes: number
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  booking?: BookingDetails
}

const WELCOME: Message = {
  role: 'assistant',
  content: 'Welcome. I\'m Zara — your personal booking assistant. I\'m here to help you create the perfect salon experience. What would you like to book today?',
}

const QUICK_REPLIES = [
  'Book a haircut',
  'Schedule a blowout',
  'Book a facial',
  'Hair colour appointment',
]

export default function ChatWidget() {
  const [messages, setMessages]   = useState<Message[]>([WELCOME])
  const [input, setInput]         = useState('')
  const [streaming, setStreaming] = useState(false)
  const [focused, setFocused]     = useState(false)
  const bottomRef                 = useRef<HTMLDivElement>(null)
  const inputRef                  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || streaming) return

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setInput('')
    setStreaming(true)

    const assistantIdx = messages.length + 1
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content: msg }] }),
      })

      if (!res.body) throw new Error('No response body')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buf     = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') break

          let parsed: { type?: string; content?: string; booking?: BookingDetails }
          try { parsed = JSON.parse(raw) } catch { continue }

          if (parsed.type === 'delta' && parsed.content) {
            setMessages(prev => {
              const next = [...prev]
              next[assistantIdx] = { ...next[assistantIdx], content: next[assistantIdx].content + parsed.content }
              return next
            })
          } else if (parsed.type === 'booking' && parsed.booking) {
            setMessages(prev => {
              const next = [...prev]
              next[assistantIdx] = { ...next[assistantIdx], booking: parsed.booking }
              return next
            })
          } else if (parsed.type === 'error') {
            setMessages(prev => {
              const next = [...prev]
              next[assistantIdx] = { ...next[assistantIdx], content: 'I\'m sorry, something went wrong. Please try again.' }
              return next
            })
          }
        }
      }
    } catch {
      setMessages(prev => {
        const next = [...prev]
        next[assistantIdx] = { ...next[assistantIdx], content: 'I\'m sorry, I couldn\'t connect to the booking service. Please try again.' }
        return next
      })
    } finally {
      setStreaming(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const showQuickReplies = messages.length === 1 && !streaming

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-base)',
      fontFamily: 'var(--font-dm-sans)',
      position: 'relative', overflow: 'hidden',
    }}>

      {/* ── Ambient background glow ───────────────────────────────── */}
      <div style={{
        position: 'absolute', top: '15%', left: '50%',
        transform: 'translateX(-50%)',
        width: '90%', height: '50%',
        background: 'radial-gradient(ellipse at center, rgba(107,31,31,0.14) 0%, rgba(107,31,31,0.04) 50%, transparent 70%)',
        animation: 'ambient-breathe 7s ease-in-out infinite',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '-10%',
        width: '60%', height: '40%',
        background: 'radial-gradient(ellipse, rgba(196,146,62,0.05) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Header ───────────────────────────────────────────────── */}
      <header style={{
        flexShrink: 0, position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '14px 18px 13px',
        background: 'linear-gradient(180deg, rgba(22,14,8,1) 0%, rgba(18,11,6,0.98) 100%)',
      }}>

        {/* Pulsing avatar */}
        <div style={{ position: 'relative', flexShrink: 0, width: '42px', height: '42px' }}>
          {/* Outer pulse ring */}
          <div style={{
            position: 'absolute', inset: '-5px', borderRadius: '50%',
            border: '1px solid var(--gold)',
            animation: 'pulse-ring 2.8s ease-out infinite',
            pointerEvents: 'none',
          }} />
          {/* Avatar circle */}
          <div style={{
            width: '42px', height: '42px', borderRadius: '50%',
            background: 'linear-gradient(145deg, #C4923E 0%, #7A5A1A 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'avatar-glow 4s ease-in-out infinite',
            border: '1.5px solid rgba(196,146,62,0.5)',
          }}>
            <span style={{
              fontFamily: 'var(--font-cormorant)',
              fontSize: '22px', color: '#140C04', fontWeight: 600, lineHeight: 1,
            }}>Z</span>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            color: 'var(--cream)', fontSize: '15px', fontWeight: 500,
            letterSpacing: '0.03em', marginBottom: '3px',
          }}>Zara</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#4ADE80',
              boxShadow: '0 0 5px rgba(74,222,128,0.6)',
            }} />
            <span style={{ color: 'var(--cream-muted)', fontSize: '11px', letterSpacing: '0.05em' }}>
              Booking Assistant · Available now
            </span>
          </div>
        </div>

        {/* Wordmark */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{
            fontFamily: 'var(--font-cormorant)', fontSize: '15px',
            color: 'var(--gold-lt)', letterSpacing: '0.12em',
            fontStyle: 'italic', opacity: 0.75, lineHeight: 1,
          }}>Huzi Salon</p>
          <p style={{
            color: 'var(--cream-ghost)', fontSize: '9px',
            letterSpacing: '0.18em', textTransform: 'uppercase',
            marginTop: '2px',
          }}>Lahore</p>
        </div>
      </header>

      {/* Gold accent rule */}
      <div style={{
        height: '1px', flexShrink: 0, zIndex: 2, position: 'relative',
        background: 'linear-gradient(90deg, transparent 0%, var(--gold) 40%, var(--gold-bright) 50%, var(--gold) 60%, transparent 100%)',
        opacity: 0.4,
      }} />

      {/* ── Message list ─────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1,
        padding: '20px 16px 4px',
        overscrollBehavior: 'contain',
      }}>

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} index={i} />
        ))}

        {/* Quick replies — shown only on fresh welcome state */}
        {showQuickReplies && (
          <div style={{
            marginTop: '8px', marginLeft: '38px',
            display: 'flex', flexWrap: 'wrap', gap: '8px',
            animation: 'floatIn 0.5s cubic-bezier(0.16,1,0.3,1) 0.35s both',
          }}>
            {QUICK_REPLIES.map(q => (
              <QuickReplyPill key={q} label={q} onSelect={() => send(q)} />
            ))}
          </div>
        )}

        {streaming && messages[messages.length - 1]?.content === '' && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>

      {/* ── Input area ───────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, padding: '12px 16px 20px',
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        position: 'relative', zIndex: 2,
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: '10px',
          padding: '10px 12px',
          borderRadius: '16px',
          background: 'var(--bg-raised)',
          border: `1px solid ${focused ? 'var(--border-bright)' : 'var(--border-mid)'}`,
          boxShadow: focused
            ? '0 0 0 3px rgba(196,146,62,0.08), 0 4px 20px rgba(0,0,0,0.4)'
            : '0 2px 10px rgba(0,0,0,0.4)',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Message Zara…"
            disabled={streaming}
            className="chat-textarea"
            style={{
              flex: 1, resize: 'none', border: 'none', outline: 'none',
              background: 'transparent',
              fontSize: '14px', color: 'var(--cream)',
              fontFamily: 'var(--font-dm-sans)',
              lineHeight: '1.55',
              paddingTop: '3px', paddingBottom: '3px',
            }}
          />

          <button
            onClick={() => send()}
            disabled={!input.trim() || streaming}
            style={{
              flexShrink: 0, width: '34px', height: '34px',
              borderRadius: '10px', border: 'none',
              cursor: input.trim() && !streaming ? 'pointer' : 'default',
              background: input.trim() && !streaming
                ? 'linear-gradient(135deg, #C4923E 0%, #7A5A1A 100%)'
                : 'rgba(196,146,62,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease',
              boxShadow: input.trim() && !streaming ? '0 2px 10px rgba(196,146,62,0.35)' : 'none',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M1.5 7H12.5M12.5 7L7.5 2M12.5 7L7.5 12"
                stroke={input.trim() && !streaming ? '#140C04' : 'rgba(196,146,62,0.35)'}
                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <p style={{
          textAlign: 'center', fontSize: '10px',
          color: 'var(--cream-dim)', marginTop: '7px',
          letterSpacing: '0.05em',
        }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}

/* ── Quick reply pill ────────────────────────────────────────────── */

function QuickReplyPill({ label, onSelect }: { label: string; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 13px',
        borderRadius: '20px',
        border: `1px solid ${hovered ? 'var(--border-bright)' : 'var(--border-mid)'}`,
        background: hovered ? 'rgba(196,146,62,0.12)' : 'rgba(196,146,62,0.04)',
        color: hovered ? 'var(--gold-bright)' : 'var(--gold-lt)',
        fontSize: '12px',
        fontFamily: 'var(--font-dm-sans)',
        cursor: 'pointer',
        letterSpacing: '0.03em',
        transition: 'all 0.18s ease',
        outline: 'none',
      }}
    >
      {label}
    </button>
  )
}

/* ── Message bubble ──────────────────────────────────────────────── */

function MessageBubble({ msg, index }: { msg: Message; index: number }) {
  const isUser = msg.role === 'user'

  // Don't render the shell while TypingIndicator is covering it
  if (!msg.content && !msg.booking) return null

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '14px',
      animation: 'fadeUp 0.35s cubic-bezier(0.16,1,0.3,1) both',
      animationDelay: `${Math.min(index * 0.04, 0.18)}s`,
    }}>
      {/* Zara avatar */}
      {!isUser && (
        <div style={{
          flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%',
          background: 'linear-gradient(145deg, #C4923E 0%, #7A5A1A 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginRight: '9px', marginTop: '3px',
          boxShadow: '0 0 10px rgba(196,146,62,0.2)',
          border: '1px solid rgba(196,146,62,0.3)',
        }}>
          <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: '13px', color: '#140C04', fontWeight: 600 }}>Z</span>
        </div>
      )}

      <div style={{ maxWidth: 'min(74%, 310px)' }}>
        {msg.content && (
          <div style={isUser ? {
            background: 'var(--bubble-user)',
            color: 'var(--cream)',
            borderRadius: '16px 16px 3px 16px',
            padding: '10px 14px',
            fontSize: '14px', lineHeight: '1.6',
            boxShadow: '0 4px 18px rgba(107,31,31,0.35), 0 1px 4px rgba(0,0,0,0.5)',
          } : {
            background: 'var(--bubble-zara)',
            color: 'var(--cream)',
            borderRadius: '3px 16px 16px 16px',
            padding: '11px 14px',
            fontSize: '15px', lineHeight: '1.65',
            border: '1px solid var(--border-mid)',
            boxShadow: '0 4px 18px rgba(0,0,0,0.4)',
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 400, letterSpacing: '0.01em',
          }}>
            {msg.content}
          </div>
        )}

        {msg.booking && <BookingCard booking={msg.booking} />}
      </div>
    </div>
  )
}

/* ── Typing indicator ────────────────────────────────────────────── */

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '14px' }}>
      <div style={{
        flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%',
        background: 'linear-gradient(145deg, #C4923E 0%, #7A5A1A 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginRight: '9px',
        border: '1px solid rgba(196,146,62,0.3)',
      }}>
        <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: '13px', color: '#140C04', fontWeight: 600 }}>Z</span>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '12px 16px',
        borderRadius: '3px 16px 16px 16px',
        background: 'var(--bubble-zara)',
        border: '1px solid var(--border-mid)',
        boxShadow: '0 4px 18px rgba(0,0,0,0.4)',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: 'var(--gold)',
            animation: 'pulse-dot 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.18}s`,
          }} />
        ))}
      </div>
    </div>
  )
}
