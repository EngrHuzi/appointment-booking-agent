import sqlite3
import os
from contextlib import contextmanager
from datetime import datetime, timedelta

DATABASE_PATH = os.getenv("DATABASE_PATH", "./local.db")

SERVICE_DURATIONS: dict[str, int] = {
    "haircut": 45,
    "hair colour": 90,
    "blowout": 30,
    "facial": 60,
    "bridal package": 180,
}


def init_db() -> None:
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS appointments (
                id                TEXT PRIMARY KEY,
                client_name       TEXT NOT NULL,
                client_email      TEXT NOT NULL,
                service           TEXT NOT NULL,
                datetime          TEXT NOT NULL,
                duration_minutes  INTEGER NOT NULL,
                status            TEXT DEFAULT 'confirmed',
                reminder_email_id TEXT,
                created_at        TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()


@contextmanager
def get_db():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def _has_conflict(dt_iso: str, duration: int, exclude_id: str = None) -> bool:
    query = """
        SELECT 1 FROM appointments
        WHERE status != 'cancelled'
        AND datetime(datetime) < datetime(:new_dt, '+' || :new_dur || ' minutes')
        AND datetime(:new_dt) < datetime(datetime, '+' || duration_minutes || ' minutes')
    """
    params: dict = {"new_dt": dt_iso, "new_dur": duration}
    if exclude_id:
        query += " AND id != :exclude_id"
        params["exclude_id"] = exclude_id
    with get_db() as conn:
        row = conn.execute(query, params).fetchone()
    return row is not None


def check_availability(service: str, dt_iso: str) -> dict:
    duration = SERVICE_DURATIONS.get(service.lower(), 60)
    if not _has_conflict(dt_iso, duration):
        return {"available": True, "service": service, "datetime": dt_iso}
    alternatives = _find_alternatives(dt_iso, duration)
    return {"available": False, "alternatives": alternatives}


def _find_alternatives(from_dt_iso: str, duration: int) -> list[str]:
    start = datetime.fromisoformat(from_dt_iso)
    candidate = start + timedelta(hours=1)
    limit = start + timedelta(days=5)
    slots: list[str] = []

    while len(slots) < 3 and candidate < limit:
        # Monday=0 … Saturday=5; skip Sunday
        if candidate.weekday() < 6:
            end_hour = candidate.hour + duration / 60
            if 10 <= candidate.hour and end_hour <= 19:
                if not _has_conflict(candidate.isoformat(), duration):
                    slots.append(candidate.isoformat())
        candidate += timedelta(hours=1)

    return slots


def create_appointment(
    appt_id: str,
    client_name: str,
    client_email: str,
    service: str,
    dt_iso: str,
    reminder_email_id: str = None,
) -> dict:
    duration = SERVICE_DURATIONS.get(service.lower(), 60)
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO appointments
                (id, client_name, client_email, service, datetime, duration_minutes, reminder_email_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (appt_id, client_name, client_email, service, dt_iso, duration, reminder_email_id),
        )
        conn.commit()
    return {
        "id": appt_id,
        "client_name": client_name,
        "client_email": client_email,
        "service": service,
        "datetime": dt_iso,
        "duration_minutes": duration,
        "status": "confirmed",
    }


def get_appointment(booking_id: str = None, email: str = None) -> dict | None:
    with get_db() as conn:
        if booking_id:
            row = conn.execute(
                "SELECT * FROM appointments WHERE id = ?", (booking_id,)
            ).fetchone()
        elif email:
            row = conn.execute(
                """SELECT * FROM appointments
                   WHERE client_email = ? AND status != 'cancelled'
                   ORDER BY datetime DESC LIMIT 1""",
                (email,),
            ).fetchone()
        else:
            return None
    return dict(row) if row else None


def update_appointment(appt_id: str, status: str, new_dt_iso: str = None, new_reminder_id: str = None) -> None:
    with get_db() as conn:
        if new_dt_iso and new_reminder_id:
            conn.execute(
                "UPDATE appointments SET status=?, datetime=?, reminder_email_id=? WHERE id=?",
                (status, new_dt_iso, new_reminder_id, appt_id),
            )
        elif new_dt_iso:
            conn.execute(
                "UPDATE appointments SET status=?, datetime=? WHERE id=?",
                (status, new_dt_iso, appt_id),
            )
        else:
            conn.execute(
                "UPDATE appointments SET status=? WHERE id=?",
                (status, appt_id),
            )
        conn.commit()


def get_all_appointments() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM appointments ORDER BY datetime DESC"
        ).fetchall()
    return [dict(r) for r in rows]
