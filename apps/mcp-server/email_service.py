import os
import resend
from datetime import datetime, timedelta, timezone

resend.api_key = os.getenv("RESEND_API_KEY", "")

SALON_NAME = os.getenv("SALON_NAME", "The Salon")
SALON_EMAIL = os.getenv("SALON_EMAIL", "noreply@resend.dev")

_FROM = f"{SALON_NAME} <{SALON_EMAIL}>"


def _fmt(dt_iso: str) -> str:
    return datetime.fromisoformat(dt_iso).strftime("%A, %B %d at %I:%M %p")


def send_confirmation(
    client_name: str, client_email: str, service: str, dt_iso: str, booking_id: str
) -> str:
    resp = resend.Emails.send({
        "from": _FROM,
        "to": [client_email],
        "subject": f"Confirmed: {service.title()} on {_fmt(dt_iso)}",
        "html": f"""
        <div style="font-family:sans-serif;max-width:520px;margin:auto">
          <h2 style="color:#1a1a1a">Booking Confirmed ✓</h2>
          <p>Hi {client_name},</p>
          <p>Your <strong>{service.title()}</strong> is confirmed for
             <strong>{_fmt(dt_iso)}</strong>.</p>
          <p style="background:#f5f5f5;padding:12px;border-radius:6px">
            Booking ID: <strong>{booking_id}</strong>
          </p>
          <p>Need to reschedule? Reply to this email with your booking ID.</p>
          <p>See you soon!<br>— {SALON_NAME}</p>
        </div>
        """,
    })
    return resp.id if hasattr(resp, "id") else ""


def send_reminder(
    client_name: str, client_email: str, service: str, dt_iso: str, booking_id: str
) -> str:
    appt_dt = datetime.fromisoformat(dt_iso)
    # Schedule 24 h before; Resend expects UTC ISO 8601
    reminder_at = (appt_dt - timedelta(hours=24)).replace(tzinfo=timezone.utc)
    scheduled_at = reminder_at.strftime("%Y-%m-%dT%H:%M:%S+00:00")

    resp = resend.Emails.send({
        "from": _FROM,
        "to": [client_email],
        "subject": f"Reminder: {service.title()} tomorrow at {appt_dt.strftime('%I:%M %p')}",
        "scheduled_at": scheduled_at,
        "html": f"""
        <div style="font-family:sans-serif;max-width:520px;margin:auto">
          <h2 style="color:#1a1a1a">See You Tomorrow!</h2>
          <p>Hi {client_name},</p>
          <p>Just a reminder — your <strong>{service.title()}</strong> is tomorrow at
             <strong>{appt_dt.strftime('%I:%M %p')}</strong>.</p>
          <p style="background:#f5f5f5;padding:12px;border-radius:6px">
            Booking ID: <strong>{booking_id}</strong>
          </p>
          <p>— {SALON_NAME}</p>
        </div>
        """,
    })
    return resp.id if hasattr(resp, "id") else ""


def send_reschedule(
    client_name: str, client_email: str, service: str, new_dt_iso: str, booking_id: str
) -> None:
    resend.Emails.send({
        "from": _FROM,
        "to": [client_email],
        "subject": f"Rescheduled: {service.title()} — new time {_fmt(new_dt_iso)}",
        "html": f"""
        <div style="font-family:sans-serif;max-width:520px;margin:auto">
          <h2 style="color:#1a1a1a">Appointment Rescheduled</h2>
          <p>Hi {client_name},</p>
          <p>Your <strong>{service.title()}</strong> has been rescheduled to
             <strong>{_fmt(new_dt_iso)}</strong>.</p>
          <p style="background:#f5f5f5;padding:12px;border-radius:6px">
            Booking ID: <strong>{booking_id}</strong>
          </p>
          <p>— {SALON_NAME}</p>
        </div>
        """,
    })


def send_cancellation(
    client_name: str, client_email: str, service: str, dt_iso: str, booking_id: str
) -> None:
    resend.Emails.send({
        "from": _FROM,
        "to": [client_email],
        "subject": f"Cancelled: {service.title()} on {_fmt(dt_iso)}",
        "html": f"""
        <div style="font-family:sans-serif;max-width:520px;margin:auto">
          <h2 style="color:#1a1a1a">Appointment Cancelled</h2>
          <p>Hi {client_name},</p>
          <p>Your <strong>{service.title()}</strong> on <strong>{_fmt(dt_iso)}</strong>
             has been cancelled.</p>
          <p style="background:#f5f5f5;padding:12px;border-radius:6px">
            Booking ID: <strong>{booking_id}</strong>
          </p>
          <p>We hope to see you again soon!<br>— {SALON_NAME}</p>
        </div>
        """,
    })


def cancel_scheduled_email(email_id: str) -> None:
    if email_id:
        try:
            resend.Emails.cancel(email_id)
        except Exception:
            pass
