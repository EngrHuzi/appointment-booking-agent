'use client'

interface BookingDetails {
  booking_id: string
  client_name: string
  service: string
  datetime: string
  duration_minutes: number
}

export default function BookingCard({ booking }: { booking: BookingDetails }) {
  const dt   = new Date(booking.datetime)
  const day  = dt.toLocaleDateString('en-US', { weekday: 'long' })
  const date = dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const time = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="animate-slide-up" style={{ marginTop: '10px', marginLeft: '-4px', fontFamily: 'var(--font-dm-sans)' }}>
      <div
        style={{
          position: 'relative', overflow: 'hidden',
          borderRadius: '16px',
          background: 'linear-gradient(145deg, #2A1600 0%, #1A0D00 50%, #120900 100%)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(196,146,62,0.25), inset 0 1px 0 rgba(196,146,62,0.15)',
        }}
      >
        {/* Gold top stripe */}
        <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #C4923E, #EAD48A, #C4923E, transparent)' }} />

        {/* Corner ornament */}
        <div style={{
          position: 'absolute', top: '12px', right: '14px',
          fontFamily: 'var(--font-cormorant)', fontSize: '60px',
          lineHeight: 1, color: '#C4923E', opacity: 0.1,
          userSelect: 'none', pointerEvents: 'none',
        }}>✦</div>

        <div style={{ padding: '16px 18px 18px' }}>

          {/* Confirmed badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
            <div style={{
              width: '18px', height: '18px', borderRadius: '50%',
              background: 'rgba(196,146,62,0.15)',
              border: '1px solid rgba(196,146,62,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1.5 4L3 5.5L6.5 2" stroke="#C4923E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{
              color: '#C4923E', fontSize: '9px',
              letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500,
            }}>Confirmed Booking</span>
          </div>

          {/* Service name */}
          <p style={{
            fontFamily: 'var(--font-cormorant)', fontSize: '26px',
            fontWeight: 500, color: 'var(--cream)',
            lineHeight: 1.1, marginBottom: '3px',
          }}>
            {booking.service.charAt(0).toUpperCase() + booking.service.slice(1)}
          </p>
          <p style={{ color: 'var(--cream-muted)', fontSize: '12px', letterSpacing: '0.04em' }}>
            {booking.duration_minutes} min · {booking.client_name}
          </p>

          {/* Divider */}
          <div style={{
            margin: '14px 0',
            height: '1px',
            background: 'linear-gradient(90deg, rgba(196,146,62,0.4), rgba(196,146,62,0.1), transparent)',
          }} />

          {/* Date / time row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <p style={{
                color: 'var(--cream-muted)', fontSize: '9px',
                letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '4px',
              }}>{day}</p>
              <p style={{ color: 'var(--cream)', fontSize: '14px', fontWeight: 400 }}>{date}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{
                color: 'var(--cream-muted)', fontSize: '9px',
                letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '4px',
              }}>Time</p>
              <p style={{
                color: '#EAD48A', fontSize: '22px',
                fontFamily: 'var(--font-cormorant)', fontWeight: 500,
                lineHeight: 1,
              }}>{time}</p>
            </div>
          </div>

          {/* Booking ID */}
          <div style={{
            marginTop: '14px', padding: '8px 12px',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(196,146,62,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{
              color: 'var(--cream-dim)', fontSize: '9px',
              letterSpacing: '0.14em', textTransform: 'uppercase',
            }}>Booking ID</span>
            <span style={{
              color: '#D4AF62', fontSize: '12px',
              fontWeight: 500, letterSpacing: '0.08em',
            }}>#{booking.booking_id}</span>
          </div>

          {/* Footer */}
          <p style={{
            color: 'var(--cream-dim)', fontSize: '11px',
            marginTop: '10px', textAlign: 'center',
            letterSpacing: '0.03em',
          }}>
            A confirmation email is on its way ✦
          </p>
        </div>

        {/* Gold bottom stripe */}
        <div style={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(196,146,62,0.4), transparent)',
        }} />
      </div>
    </div>
  )
}
