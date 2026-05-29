import os
import uuid
from datetime import datetime

from dotenv import load_dotenv

load_dotenv()

from fastmcp import FastMCP

import database as db
import email_service as email

db.init_db()


def _fmt_slot(iso: str) -> str:
    dt = datetime.fromisoformat(iso)
    return dt.strftime("%A, %B") + f" {dt.day} at " + dt.strftime("%I:%M %p").lstrip("0")

mcp = FastMCP(
    name="Salon Booking Tools",
    instructions="Tools for checking availability, booking, rescheduling, and cancelling salon appointments.",
)


@mcp.tool()
def check_availability(service: str, datetime_str: str) -> dict:
    """Check if a slot is available for the given service and datetime.

    Args:
        service: Salon service — haircut, hair colour, blowout, facial, or bridal package
        datetime_str: ISO 8601 datetime string e.g. 2024-06-15T14:00:00
    """
    result = db.check_availability(service, datetime_str)
    if not result.get("available") and result.get("alternatives"):
        result["alternatives_display"] = [_fmt_slot(s) for s in result["alternatives"]]
    return result


@mcp.tool()
def book_appointment(
    client_name: str,
    client_email: str,
    service: str,
    datetime_str: str,
) -> dict:
    """Book a confirmed appointment. Sends confirmation and 24-hour reminder emails.

    Args:
        client_name: Full name of the client
        client_email: Client email address
        service: Salon service name
        datetime_str: ISO 8601 datetime string for the appointment
    """
    availability = db.check_availability(service, datetime_str)
    if not availability["available"]:
        return {
            "success": False,
            "error": "Slot no longer available",
            "alternatives": availability.get("alternatives", []),
        }

    appt_id = str(uuid.uuid4())[:8].upper()

    try:
        email.send_confirmation(client_name, client_email, service, datetime_str, appt_id)
        reminder_id = email.send_reminder(client_name, client_email, service, datetime_str, appt_id)
    except Exception:
        reminder_id = ""

    appt = db.create_appointment(appt_id, client_name, client_email, service, datetime_str, reminder_id)

    return {
        "tool": "book_appointment",
        "success": True,
        "booking_id": appt_id,
        "client_name": client_name,
        "client_email": client_email,
        "service": service,
        "datetime": datetime_str,
        "duration_minutes": appt["duration_minutes"],
    }


@mcp.tool()
def reschedule_appointment(booking_id_or_email: str, new_datetime_str: str) -> dict:
    """Reschedule an existing appointment to a new time.

    Args:
        booking_id_or_email: Booking ID or client email
        new_datetime_str: New ISO 8601 datetime string
    """
    appt = db.get_appointment(booking_id=booking_id_or_email) or db.get_appointment(email=booking_id_or_email)
    if not appt:
        return {"success": False, "error": "Appointment not found. Check booking ID or email."}

    availability = db.check_availability(appt["service"], new_datetime_str)
    if not availability["available"]:
        return {"success": False, "error": "New slot unavailable", "alternatives": availability.get("alternatives", [])}

    email.cancel_scheduled_email(appt.get("reminder_email_id"))

    try:
        new_reminder_id = email.send_reminder(
            appt["client_name"], appt["client_email"], appt["service"], new_datetime_str, appt["id"]
        )
        email.send_reschedule(
            appt["client_name"], appt["client_email"], appt["service"], new_datetime_str, appt["id"]
        )
    except Exception:
        new_reminder_id = ""

    db.update_appointment(appt["id"], "rescheduled", new_datetime_str, new_reminder_id)

    return {
        "success": True,
        "booking_id": appt["id"],
        "client_name": appt["client_name"],
        "service": appt["service"],
        "new_datetime": new_datetime_str,
    }


@mcp.tool()
def cancel_appointment(booking_id_or_email: str) -> dict:
    """Cancel an existing appointment.

    Args:
        booking_id_or_email: Booking ID or client email
    """
    appt = db.get_appointment(booking_id=booking_id_or_email) or db.get_appointment(email=booking_id_or_email)
    if not appt:
        return {"success": False, "error": "Appointment not found. Check booking ID or email."}

    email.cancel_scheduled_email(appt.get("reminder_email_id"))

    try:
        email.send_cancellation(
            appt["client_name"], appt["client_email"], appt["service"], appt["datetime"], appt["id"]
        )
    except Exception:
        pass

    db.update_appointment(appt["id"], "cancelled")

    return {
        "success": True,
        "booking_id": appt["id"],
        "client_name": appt["client_name"],
        "service": appt["service"],
        "message": "Appointment cancelled successfully.",
    }


@mcp.tool()
def list_appointments() -> list:
    """Return all appointments ordered by datetime descending. For salon owner use only."""
    return db.get_all_appointments()


@mcp.tool()
def get_closed_dates() -> list:
    """Return all salon closed dates."""
    return db.get_closed_dates()


@mcp.tool()
def add_closed_date(date: str, reason: str = "") -> dict:
    """Mark a specific date as closed (e.g. Eid, Independence Day).

    Args:
        date: Date in YYYY-MM-DD format
        reason: Human-readable reason e.g. 'Eid ul Adha'
    """
    db.add_closed_date(date, reason)
    return {"success": True, "date": date, "reason": reason}


@mcp.tool()
def remove_closed_date(date: str) -> dict:
    """Remove a closed date, making it bookable again.

    Args:
        date: Date in YYYY-MM-DD format
    """
    db.remove_closed_date(date)
    return {"success": True, "date": date}


if __name__ == "__main__":
    port = int(os.getenv("PORT") or os.getenv("MCP_PORT", "8001"))
    mcp.run(transport="sse", port=port)
