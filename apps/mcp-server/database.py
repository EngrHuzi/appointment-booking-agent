import os
import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from datetime import datetime, timedelta

DATABASE_URL = os.getenv("DATABASE_URL", "")

SERVICE_DURATIONS: dict[str, int] = {
    "haircut": 45,
    "hair colour": 90,
    "blowout": 30,
    "facial": 60,
    "bridal package": 180,
}


def init_db() -> None:
    with get_db() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS appointments (
                id                TEXT PRIMARY KEY,
                client_name       TEXT NOT NULL,
                client_email      TEXT NOT NULL,
                service           TEXT NOT NULL,
                appt_datetime     TEXT NOT NULL,
                duration_minutes  INTEGER NOT NULL,
                status            TEXT DEFAULT 'confirmed',
                reminder_email_id TEXT,
                created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        """)


@contextmanager
def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def _has_conflict(dt_iso: str, duration: int, exclude_id: str = None) -> bool:
    query = """
        SELECT 1 FROM appointments
        WHERE status != 'cancelled'
        AND appt_datetime::timestamp < %(new_dt)s::timestamp + (%(new_dur)s * interval '1 minute')
        AND %(new_dt)s::timestamp < appt_datetime::timestamp + (duration_minutes * interval '1 minute')
    """
    params: dict = {"new_dt": dt_iso, "new_dur": duration}
    if exclude_id:
        query += " AND id != %(exclude_id)s"
        params["exclude_id"] = exclude_id
    with get_db() as cur:
        cur.execute(query, params)
        return cur.fetchone() is not None


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
    with get_db() as cur:
        cur.execute(
            """
            INSERT INTO appointments
                (id, client_name, client_email, service, appt_datetime, duration_minutes, reminder_email_id)
            VALUES (%(id)s, %(name)s, %(email)s, %(service)s, %(dt)s, %(dur)s, %(rid)s)
            """,
            {
                "id": appt_id, "name": client_name, "email": client_email,
                "service": service, "dt": dt_iso, "dur": duration,
                "rid": reminder_email_id,
            },
        )
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
    with get_db() as cur:
        if booking_id:
            cur.execute(
                "SELECT *, appt_datetime AS datetime FROM appointments WHERE id = %(id)s",
                {"id": booking_id},
            )
        elif email:
            cur.execute(
                """SELECT *, appt_datetime AS datetime FROM appointments
                   WHERE client_email = %(email)s AND status != 'cancelled'
                   ORDER BY appt_datetime DESC LIMIT 1""",
                {"email": email},
            )
        else:
            return None
        row = cur.fetchone()
    return dict(row) if row else None


def update_appointment(
    appt_id: str, status: str,
    new_dt_iso: str = None, new_reminder_id: str = None,
) -> None:
    with get_db() as cur:
        if new_dt_iso and new_reminder_id:
            cur.execute(
                "UPDATE appointments SET status=%(s)s, appt_datetime=%(dt)s, reminder_email_id=%(rid)s WHERE id=%(id)s",
                {"s": status, "dt": new_dt_iso, "rid": new_reminder_id, "id": appt_id},
            )
        elif new_dt_iso:
            cur.execute(
                "UPDATE appointments SET status=%(s)s, appt_datetime=%(dt)s WHERE id=%(id)s",
                {"s": status, "dt": new_dt_iso, "id": appt_id},
            )
        else:
            cur.execute(
                "UPDATE appointments SET status=%(s)s WHERE id=%(id)s",
                {"s": status, "id": appt_id},
            )


def get_all_appointments() -> list[dict]:
    with get_db() as cur:
        cur.execute(
            "SELECT *, appt_datetime AS datetime FROM appointments ORDER BY appt_datetime DESC"
        )
        rows = cur.fetchall()
    return [dict(r) for r in rows]
