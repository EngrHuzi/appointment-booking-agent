'use client'

import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'salon_dashboard_key'

type Tab = 'all' | 'today' | 'closures'

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

interface Closure {
  date: string
  reason: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDT(iso: string) {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function exportCSV(bookings: Booking[]) {
  const headers = ['ID', 'Client Name', 'Email', 'Service', 'Date & Time', 'Duration (min)', 'Status']
  const rows = bookings.map(b => [b.id, b.client_name, b.client_email, b.service, b.datetime, b.duration_minutes, b.status])
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `huzi-salon-bookings-${todayStr()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Booking['status'] }) {
  const cfg = {
    confirmed:   { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.35)',  color: '#4ade80', label: 'Confirmed' },
    rescheduled: { bg: 'rgba(234,196,62,0.12)', border: 'rgba(234,196,62,0.35)', color: '#EAD48A', label: 'Rescheduled' },
    cancelled:   { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  color: '#f87171', label: 'Cancelled' },
  }[status] ?? { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.2)', color: '#ccc', label: status }

  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
      fontSize: '11px', fontWeight: 500, letterSpacing: '0.04em',
      background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  )
}

function Btn({
  onClick, disabled, children, variant = 'ghost',
}: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode; variant?: 'ghost' | 'danger' | 'gold' | 'outline'
}) {
  const styles: Record<string, React.CSSProperties> = {
    ghost:   { background: 'transparent', border: '1px solid var(--border-mid)', color: '#C4923E' },
    danger:  { background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' },
    gold:    { background: 'linear-gradient(135deg,#C4923E,#D4AF62)', border: 'none', color: '#0B0705', fontWeight: 600 },
    outline: { background: 'transparent', border: '1px solid var(--border-mid)', color: 'var(--cream-muted)' },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 12px', borderRadius: '7px', fontSize: '11px',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
        fontFamily: 'var(--font-dm-sans)', letterSpacing: '0.03em',
        ...styles[variant],
      }}
    >
      {children}
    </button>
  )
}

// ─── Login ───────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (key: string) => void }) {
  const [key, setKey] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!key.trim()) return
    setLoading(true); setError(false)
    const res = await fetch('/api/bookings', { headers: { 'X-API-Key': key.trim() } })
    setLoading(false)
    if (res.ok) { localStorage.setItem(STORAGE_KEY, key.trim()); onLogin(key.trim()) }
    else setError(true)
  }

  return (
    <div style={{ height: '100vh', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '380px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '20px', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
        <div style={{ height: '2px', background: 'linear-gradient(90deg,transparent,#C4923E,#EAD48A,#C4923E,transparent)' }} />
        <div style={{ padding: '36px 32px 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <p style={{ color: '#C4923E', fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '8px' }}>Owner Access</p>
            <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '32px', fontWeight: 500, color: 'var(--cream)', lineHeight: 1.1 }}>Huzi Salon</h1>
            <p style={{ color: 'var(--cream-muted)', fontSize: '13px', marginTop: '6px' }}>Bookings Dashboard</p>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--cream-muted)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>API Key</label>
              <input
                ref={inputRef} type="password" value={key}
                onChange={e => { setKey(e.target.value); setError(false) }}
                placeholder="Enter your API key"
                style={{ width: '100%', padding: '12px 14px', background: 'var(--bg-raised)', border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'var(--border)'}`, borderRadius: '10px', color: 'var(--cream)', fontSize: '14px', outline: 'none', fontFamily: 'var(--font-dm-sans)' }}
              />
              {error && <p style={{ color: '#f87171', fontSize: '12px', marginTop: '6px' }}>Invalid API key. Try again.</p>}
            </div>
            <button type="submit" disabled={loading || !key.trim()} style={{ padding: '13px', borderRadius: '10px', border: 'none', background: loading || !key.trim() ? 'rgba(196,146,62,0.25)' : 'linear-gradient(135deg,#C4923E,#D4AF62)', color: loading || !key.trim() ? 'rgba(196,146,62,0.5)' : '#0B0705', fontSize: '14px', fontWeight: 600, cursor: loading || !key.trim() ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans)' }}>
              {loading ? 'Verifying…' : 'Enter Dashboard'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── All Bookings Tab ────────────────────────────────────────────────────────

function AllBookingsTab({ bookings, apiKey, onRefresh }: { bookings: Booking[]; apiKey: string; onRefresh: () => void }) {
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const confirmed   = bookings.filter(b => b.status === 'confirmed').length
  const rescheduled = bookings.filter(b => b.status === 'rescheduled').length
  const cancelled   = bookings.filter(b => b.status === 'cancelled').length

  async function handleCancel(id: string) {
    if (!confirm('Cancel this booking? A cancellation email will be sent.')) return
    setActionLoading(id); setActionError(null)
    const res = await fetch(`/api/bookings/${id}/cancel`, { method: 'POST', headers: { 'X-API-Key': apiKey } })
    setActionLoading(null)
    if (res.ok) onRefresh()
    else setActionError('Cancel failed. Try again.')
  }

  async function handleReschedule(id: string) {
    if (!rescheduleDate) return
    setActionLoading(id); setActionError(null)
    const res = await fetch(`/api/bookings/${id}/reschedule`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_datetime: rescheduleDate }),
    })
    const data = await res.json()
    setActionLoading(null)
    if (res.ok && data.success) { setRescheduleId(null); setRescheduleDate(''); onRefresh() }
    else setActionError(data.error ?? 'Reschedule failed.')
  }

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Total',       value: bookings.length, color: '#D4AF62' },
          { label: 'Confirmed',   value: confirmed,       color: '#4ade80' },
          { label: 'Rescheduled', value: rescheduled,     color: '#EAD48A' },
          { label: 'Cancelled',   value: cancelled,       color: '#f87171' },
        ].map(s => (
          <div key={s.label} style={{ padding: '18px 20px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <p style={{ color: 'var(--cream-muted)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>{s.label}</p>
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '32px', fontWeight: 500, color: s.color, lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {actionError && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>
          {actionError}
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid var(--border)' }}>
      <div style={{ background: 'var(--bg-surface)', borderRadius: '14px', overflow: 'hidden', minWidth: '860px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 170px 120px 160px', padding: '0 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
          {['Booking ID', 'Client', 'Service', 'Date & Time', 'Status', 'Actions'].map(col => (
            <div key={col} style={{ padding: '11px 8px', color: 'var(--cream-muted)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{col}</div>
          ))}
        </div>

        {bookings.length === 0 && (
          <div style={{ padding: '56px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '22px', color: 'var(--cream-muted)' }}>No bookings yet</p>
          </div>
        )}

        {bookings.map((b, i) => (
          <div key={b.id}>
            <div
              style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 170px 120px 160px', padding: '0 16px', borderBottom: i < bookings.length - 1 ? '1px solid rgba(196,146,62,0.07)' : 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(196,146,62,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#D4AF62', fontSize: '11px', fontWeight: 500 }}>#{b.id}</span>
              </div>
              <div style={{ padding: '14px 8px' }}>
                <p style={{ color: 'var(--cream)', fontSize: '13px', marginBottom: '2px' }}>{b.client_name}</p>
                <p style={{ color: 'var(--cream-dim)', fontSize: '11px' }}>{b.client_email}</p>
              </div>
              <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
                <div>
                  <p style={{ color: 'var(--cream-muted)', fontSize: '12px' }}>{b.service.charAt(0).toUpperCase() + b.service.slice(1)}</p>
                  <p style={{ color: 'var(--cream-dim)', fontSize: '11px' }}>{b.duration_minutes} min</p>
                </div>
              </div>
              <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
                <span style={{ color: 'var(--cream-muted)', fontSize: '12px' }}>{fmtDT(b.datetime)}</span>
              </div>
              <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
                <StatusBadge status={b.status} />
              </div>
              <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {b.status !== 'cancelled' && (
                  <>
                    <Btn variant="ghost" disabled={actionLoading === b.id} onClick={() => { setRescheduleId(rescheduleId === b.id ? null : b.id); setRescheduleDate(''); setActionError(null) }}>
                      Reschedule
                    </Btn>
                    <Btn variant="danger" disabled={actionLoading === b.id} onClick={() => handleCancel(b.id)}>
                      {actionLoading === b.id ? '…' : 'Cancel'}
                    </Btn>
                  </>
                )}
              </div>
            </div>

            {/* Inline reschedule form */}
            {rescheduleId === b.id && (
              <div style={{ padding: '12px 16px 14px 110px', borderBottom: i < bookings.length - 1 ? '1px solid rgba(196,146,62,0.07)' : 'none', background: 'rgba(196,146,62,0.04)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="datetime-local"
                  value={rescheduleDate}
                  onChange={e => setRescheduleDate(e.target.value)}
                  style={{ padding: '8px 12px', background: 'var(--bg-raised)', border: '1px solid var(--border-mid)', borderRadius: '8px', color: 'var(--cream)', fontSize: '13px', outline: 'none', fontFamily: 'var(--font-dm-sans)', colorScheme: 'dark' }}
                />
                <Btn variant="gold" disabled={!rescheduleDate || actionLoading === b.id} onClick={() => handleReschedule(b.id)}>
                  {actionLoading === b.id ? 'Saving…' : 'Confirm'}
                </Btn>
                <Btn variant="outline" onClick={() => { setRescheduleId(null); setRescheduleDate('') }}>✕</Btn>
              </div>
            )}
          </div>
        ))}
      </div>
      </div>

      <p style={{ color: 'var(--cream-dim)', fontSize: '11px', textAlign: 'center', marginTop: '20px' }}>
        {bookings.length} booking{bookings.length !== 1 ? 's' : ''} · newest first
      </p>
    </div>
  )
}

// ─── Today Tab ───────────────────────────────────────────────────────────────

function TodayTab({ bookings }: { bookings: Booking[] }) {
  const today = todayStr()
  const todayBookings = bookings.filter(b => b.datetime.startsWith(today))
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '26px', fontWeight: 500, color: 'var(--cream)' }}>Today</h2>
        <span style={{ color: 'var(--cream-dim)', fontSize: '13px' }}>{dateLabel}</span>
        <span style={{ marginLeft: 'auto', color: '#D4AF62', fontSize: '13px', fontWeight: 500 }}>
          {todayBookings.filter(b => b.status !== 'cancelled').length} appointment{todayBookings.filter(b => b.status !== 'cancelled').length !== 1 ? 's' : ''}
        </span>
      </div>

      {todayBookings.length === 0 ? (
        <div style={{ padding: '64px', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '14px' }}>
          <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '24px', color: 'var(--cream-muted)', marginBottom: '8px' }}>No appointments today</p>
          <p style={{ color: 'var(--cream-dim)', fontSize: '13px' }}>Enjoy the quiet day.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {todayBookings
            .sort((a, b) => a.datetime.localeCompare(b.datetime))
            .map(b => {
              const time = new Date(b.datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              return (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '16px 20px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                  <div style={{ minWidth: '70px', textAlign: 'center' }}>
                    <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '22px', color: '#EAD48A', fontWeight: 500, lineHeight: 1 }}>{time.split(' ')[0]}</p>
                    <p style={{ color: 'var(--cream-dim)', fontSize: '11px' }}>{time.split(' ')[1]}</p>
                  </div>
                  <div style={{ width: '1px', height: '36px', background: 'var(--border)' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ color: 'var(--cream)', fontSize: '14px', marginBottom: '2px' }}>{b.client_name}</p>
                    <p style={{ color: 'var(--cream-muted)', fontSize: '12px' }}>{b.service.charAt(0).toUpperCase() + b.service.slice(1)} · {b.duration_minutes} min</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: 'var(--cream-dim)', fontSize: '11px' }}>{b.client_email}</span>
                    <StatusBadge status={b.status} />
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

// ─── Closures Tab ────────────────────────────────────────────────────────────

function ClosuresTab({ apiKey, refreshKey }: { apiKey: string; refreshKey: number }) {
  const [closures, setClosures] = useState<Closure[]>([])
  const [loading, setLoading] = useState(true)
  const [newDate, setNewDate] = useState('')
  const [newReason, setNewReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadClosures() {
    setLoading(true)
    const res = await fetch('/api/closures', { headers: { 'X-API-Key': apiKey } })
    if (res.ok) setClosures(await res.json())
    setLoading(false)
  }

  useEffect(() => { loadClosures() }, [refreshKey])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newDate) return
    setSaving(true); setError(null)
    const res = await fetch('/api/closures', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newDate, reason: newReason }),
    })
    setSaving(false)
    if (res.ok) { setNewDate(''); setNewReason(''); loadClosures() }
    else setError('Failed to add closure.')
  }

  async function handleRemove(date: string) {
    setRemoving(date)
    const res = await fetch(`/api/closures/${date}`, { method: 'DELETE', headers: { 'X-API-Key': apiKey } })
    setRemoving(null)
    if (res.ok) loadClosures()
  }

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '26px', fontWeight: 500, color: 'var(--cream)' }}>Closed Dates</h2>
        <span style={{ color: 'var(--cream-dim)', fontSize: '13px' }}>Eid, holidays, breaks</span>
      </div>

      {/* Add form */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px', marginBottom: '20px' }}>
        <p style={{ color: 'var(--cream-muted)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '16px' }}>Add Closure</p>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 auto' }}>
            <label style={{ display: 'block', color: 'var(--cream-dim)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Date</label>
            <input
              type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required
              style={{ padding: '9px 12px', background: 'var(--bg-raised)', border: '1px solid var(--border-mid)', borderRadius: '8px', color: 'var(--cream)', fontSize: '13px', outline: 'none', fontFamily: 'var(--font-dm-sans)', colorScheme: 'dark' }}
            />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', color: 'var(--cream-dim)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Reason (optional)</label>
            <input
              type="text" value={newReason} onChange={e => setNewReason(e.target.value)}
              placeholder="e.g. Eid ul Adha"
              style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-raised)', border: '1px solid var(--border-mid)', borderRadius: '8px', color: 'var(--cream)', fontSize: '13px', outline: 'none', fontFamily: 'var(--font-dm-sans)' }}
            />
          </div>
          <button type="submit" disabled={saving || !newDate} style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: saving || !newDate ? 'rgba(196,146,62,0.25)' : 'linear-gradient(135deg,#C4923E,#D4AF62)', color: saving || !newDate ? 'rgba(196,146,62,0.5)' : '#0B0705', fontSize: '13px', fontWeight: 600, cursor: saving || !newDate ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-dm-sans)', whiteSpace: 'nowrap' }}>
            {saving ? 'Saving…' : 'Close Date'}
          </button>
        </form>
        {error && <p style={{ color: '#f87171', fontSize: '12px', marginTop: '10px' }}>{error}</p>}
      </div>

      {/* List */}
      <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid var(--border)' }}>
      <div style={{ background: 'var(--bg-surface)', borderRadius: '14px', overflow: 'hidden', minWidth: '500px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr auto', padding: '0 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
          {['Date', 'Reason', ''].map((col, i) => (
            <div key={i} style={{ padding: '11px 8px', color: 'var(--cream-muted)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{col}</div>
          ))}
        </div>

        {loading && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--cream-dim)', fontSize: '13px' }}>Loading…</div>}

        {!loading && closures.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <p style={{ color: 'var(--cream-muted)', fontSize: '14px' }}>No closed dates — salon is open Mon–Sat by default.</p>
          </div>
        )}

        {!loading && closures.map((c, i) => (
          <div key={c.date} style={{ display: 'grid', gridTemplateColumns: '200px 1fr auto', padding: '0 20px', borderBottom: i < closures.length - 1 ? '1px solid rgba(196,146,62,0.07)' : 'none', alignItems: 'center' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(196,146,62,0.03)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ padding: '14px 8px' }}>
              <p style={{ color: 'var(--cream)', fontSize: '13px' }}>{fmtDate(c.date)}</p>
              <p style={{ color: 'var(--cream-dim)', fontSize: '11px' }}>{c.date}</p>
            </div>
            <div style={{ padding: '14px 8px' }}>
              <span style={{ color: 'var(--cream-muted)', fontSize: '13px' }}>{c.reason || '—'}</span>
            </div>
            <div style={{ padding: '14px 8px' }}>
              <Btn variant="danger" disabled={removing === c.date} onClick={() => handleRemove(c.date)}>
                {removing === c.date ? '…' : 'Remove'}
              </Btn>
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

function Dashboard({ apiKey, onLogout }: { apiKey: string; onLogout: () => void }) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [refreshKey, setRefreshKey] = useState(0)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/bookings', { headers: { 'X-API-Key': apiKey } })
    if (res.ok) setBookings(await res.json())
    setLastRefresh(new Date())
    setLoading(false)
    setRefreshKey(k => k + 1)
  }

  useEffect(() => { load() }, [])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: 'All Bookings' },
    { id: 'today', label: 'Today' },
    { id: 'closures', label: 'Closed Dates' },
  ]

  return (
    <div style={{ height: '100vh', overflowY: 'auto', overflowX: 'hidden', background: 'var(--bg-base)', fontFamily: 'var(--font-dm-sans)' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(11,7,5,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '58px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: '22px', fontWeight: 500, color: 'var(--cream)' }}>Huzi Salon</h1>
              <span style={{ color: 'var(--cream-dim)', fontSize: '12px' }}>/ Dashboard</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--cream-dim)', fontSize: '11px' }}>
                {lastRefresh.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
              {activeTab === 'all' && bookings.length > 0 && (
                <Btn variant="outline" onClick={() => exportCSV(bookings)}>↓ CSV</Btn>
              )}
              <Btn variant="ghost" disabled={loading} onClick={load}>{loading ? '…' : 'Refresh'}</Btn>
              <Btn variant="danger" onClick={onLogout}>Sign out</Btn>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '2px', paddingBottom: '0' }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding: '8px 18px', fontSize: '13px', background: 'transparent', border: 'none',
                borderBottom: activeTab === t.id ? '2px solid #C4923E' : '2px solid transparent',
                color: activeTab === t.id ? '#C4923E' : 'var(--cream-muted)',
                cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', transition: 'color 0.15s',
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '28px 24px 48px' }}>
        {loading && activeTab !== 'closures' && (
          <div style={{ textAlign: 'center', padding: '64px', color: 'var(--cream-dim)' }}>Loading…</div>
        )}
        {!loading && activeTab === 'all' && <AllBookingsTab bookings={bookings} apiKey={apiKey} onRefresh={load} />}
        {!loading && activeTab === 'today' && <TodayTab bookings={bookings} />}
        {activeTab === 'closures' && <ClosuresTab apiKey={apiKey} refreshKey={refreshKey} />}
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setApiKey(localStorage.getItem(STORAGE_KEY))
    setReady(true)
  }, [])

  if (!ready) return null

  return apiKey
    ? <Dashboard apiKey={apiKey} onLogout={() => { localStorage.removeItem(STORAGE_KEY); setApiKey(null) }} />
    : <LoginScreen onLogin={k => { setApiKey(k) }} />
}
