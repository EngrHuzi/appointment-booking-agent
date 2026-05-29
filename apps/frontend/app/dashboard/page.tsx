'use client'

import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'salon_dashboard_key'

interface Booking {
  id: string
  client_name: string
  client_email: string
  service: string
  datetime: string
  duration_minutes: number
  status: 'confirmed' | 'rescheduled' | 'cancelled'
  created_at: string
}

function fmt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function StatusBadge({ status }: { status: Booking['status'] }) {
  const cfg = {
    confirmed:   { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.35)',  text: '#4ade80', label: 'Confirmed' },
    rescheduled: { bg: 'rgba(234,196,62,0.12)', border: 'rgba(234,196,62,0.35)', text: '#EAD48A', label: 'Rescheduled' },
    cancelled:   { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  text: '#f87171', label: 'Cancelled' },
  }[status] ?? { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.2)', text: '#ccc', label: status }

  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: 500,
      letterSpacing: '0.04em',
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      color: cfg.text,
    }}>
      {cfg.label}
    </span>
  )
}

function LoginScreen({ onLogin }: { onLogin: (key: string) => void }) {
  const [key, setKey] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!key.trim()) return
    setLoading(true)
    setError(false)
    const res = await fetch('/api/bookings', { headers: { 'X-API-Key': key.trim() } })
    setLoading(false)
    if (res.ok) {
      localStorage.setItem(STORAGE_KEY, key.trim())
      onLogin(key.trim())
    } else {
      setError(true)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', padding: '24px',
    }}>
      <div style={{
        width: '100%', maxWidth: '380px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
      }}>
        <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #C4923E, #EAD48A, #C4923E, transparent)' }} />
        <div style={{ padding: '36px 32px 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <p style={{ color: '#C4923E', fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '8px' }}>
              Owner Access
            </p>
            <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '32px', fontWeight: 500, color: 'var(--cream)', lineHeight: 1.1 }}>
              Huzi Salon
            </h1>
            <p style={{ color: 'var(--cream-muted)', fontSize: '13px', marginTop: '6px' }}>Bookings Dashboard</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--cream-muted)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>
                API Key
              </label>
              <input
                ref={inputRef}
                type="password"
                value={key}
                onChange={e => { setKey(e.target.value); setError(false) }}
                placeholder="Enter your API key"
                style={{
                  width: '100%', padding: '12px 14px',
                  background: 'var(--bg-raised)',
                  border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'var(--border)'}`,
                  borderRadius: '10px',
                  color: 'var(--cream)',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'var(--font-dm-sans)',
                }}
              />
              {error && (
                <p style={{ color: '#f87171', fontSize: '12px', marginTop: '6px' }}>
                  Invalid API key. Try again.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !key.trim()}
              style={{
                padding: '13px',
                borderRadius: '10px',
                border: 'none',
                background: loading || !key.trim()
                  ? 'rgba(196,146,62,0.25)'
                  : 'linear-gradient(135deg, #C4923E, #D4AF62)',
                color: loading || !key.trim() ? 'rgba(196,146,62,0.5)' : '#0B0705',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading || !key.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-dm-sans)',
                letterSpacing: '0.04em',
              }}
            >
              {loading ? 'Verifying…' : 'Enter Dashboard'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function Dashboard({ apiKey, onLogout }: { apiKey: string; onLogout: () => void }) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/bookings', { headers: { 'X-API-Key': apiKey } })
      if (!res.ok) throw new Error('Failed to fetch bookings')
      const data = await res.json()
      setBookings(Array.isArray(data) ? data : [])
      setLastRefresh(new Date())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const confirmed   = bookings.filter(b => b.status === 'confirmed').length
  const rescheduled = bookings.filter(b => b.status === 'rescheduled').length
  const cancelled   = bookings.filter(b => b.status === 'cancelled').length

  return (
    <div style={{
      minHeight: '100vh', overflowY: 'auto',
      background: 'var(--bg-base)',
      fontFamily: 'var(--font-dm-sans)',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(11,7,5,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '22px', fontWeight: 500, color: 'var(--cream)' }}>
                Huzi Salon
              </h1>
              <span style={{ color: 'var(--cream-dim)', fontSize: '12px' }}>/ Bookings</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: 'var(--cream-dim)', fontSize: '11px' }}>
                {lastRefresh.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
              <button
                onClick={load}
                disabled={loading}
                style={{
                  padding: '7px 14px', borderRadius: '8px',
                  border: '1px solid var(--border-mid)',
                  background: 'transparent',
                  color: '#C4923E', fontSize: '12px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-dm-sans)',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {loading ? '…' : 'Refresh'}
              </button>
              <button
                onClick={onLogout}
                style={{
                  padding: '7px 14px', borderRadius: '8px',
                  border: '1px solid rgba(239,68,68,0.25)',
                  background: 'transparent',
                  color: '#f87171', fontSize: '12px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-dm-sans)',
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px 48px' }}>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {[
            { label: 'Total Bookings', value: bookings.length, color: '#D4AF62' },
            { label: 'Confirmed',      value: confirmed,       color: '#4ade80' },
            { label: 'Cancelled',      value: cancelled + rescheduled, color: '#f87171' },
          ].map(stat => (
            <div key={stat.label} style={{
              padding: '20px 24px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '14px',
            }}>
              <p style={{ color: 'var(--cream-muted)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>
                {stat.label}
              </p>
              <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '36px', fontWeight: 500, color: stat.color, lineHeight: 1 }}>
                {loading ? '—' : stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '100px 1fr 120px 180px 120px',
            padding: '0 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-raised)',
          }}>
            {['Booking ID', 'Client', 'Service', 'Date & Time', 'Status'].map(col => (
              <div key={col} style={{
                padding: '12px 8px',
                color: 'var(--cream-muted)',
                fontSize: '10px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontWeight: 500,
              }}>
                {col}
              </div>
            ))}
          </div>

          {/* Rows */}
          {loading && (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--cream-dim)', fontSize: '14px' }}>
              Loading bookings…
            </div>
          )}

          {error && !loading && (
            <div style={{ padding: '48px', textAlign: 'center', color: '#f87171', fontSize: '14px' }}>
              {error}
            </div>
          )}

          {!loading && !error && bookings.length === 0 && (
            <div style={{ padding: '64px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '24px', color: 'var(--cream-muted)', marginBottom: '8px' }}>
                No bookings yet
              </p>
              <p style={{ color: 'var(--cream-dim)', fontSize: '13px' }}>
                Bookings will appear here once clients start using the chat.
              </p>
            </div>
          )}

          {!loading && !error && bookings.map((b, i) => (
            <div
              key={b.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '100px 1fr 120px 180px 120px',
                padding: '0 20px',
                borderBottom: i < bookings.length - 1 ? '1px solid rgba(196,146,62,0.08)' : 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(196,146,62,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ padding: '16px 8px', display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#D4AF62', fontSize: '12px', fontWeight: 500, letterSpacing: '0.06em' }}>
                  #{b.id}
                </span>
              </div>
              <div style={{ padding: '16px 8px' }}>
                <p style={{ color: 'var(--cream)', fontSize: '13px', fontWeight: 400, marginBottom: '2px' }}>
                  {b.client_name}
                </p>
                <p style={{ color: 'var(--cream-dim)', fontSize: '11px' }}>{b.client_email}</p>
              </div>
              <div style={{ padding: '16px 8px', display: 'flex', alignItems: 'center' }}>
                <span style={{ color: 'var(--cream-muted)', fontSize: '13px' }}>
                  {b.service.charAt(0).toUpperCase() + b.service.slice(1)}
                  <span style={{ color: 'var(--cream-dim)', fontSize: '11px', display: 'block' }}>
                    {b.duration_minutes} min
                  </span>
                </span>
              </div>
              <div style={{ padding: '16px 8px', display: 'flex', alignItems: 'center' }}>
                <span style={{ color: 'var(--cream-muted)', fontSize: '12px' }}>{fmt(b.datetime)}</span>
              </div>
              <div style={{ padding: '16px 8px', display: 'flex', alignItems: 'center' }}>
                <StatusBadge status={b.status} />
              </div>
            </div>
          ))}
        </div>

        <p style={{ color: 'var(--cream-dim)', fontSize: '11px', textAlign: 'center', marginTop: '24px' }}>
          {bookings.length} booking{bookings.length !== 1 ? 's' : ''} · sorted newest first
        </p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    setApiKey(stored)
    setReady(true)
  }, [])

  function handleLogin(key: string) { setApiKey(key) }
  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY)
    setApiKey(null)
  }

  if (!ready) return null

  return apiKey
    ? <Dashboard apiKey={apiKey} onLogout={handleLogout} />
    : <LoginScreen onLogin={handleLogin} />
}
