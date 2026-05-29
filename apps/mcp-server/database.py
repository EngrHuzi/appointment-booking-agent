import os
import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from datetime import datetime, timedelta, time as Time

DATABASE_URL = os.getenv("DATABASE_URL", "")

SERVICE_DURATIONS: dict[str, int] = {
    "haircut": 45,
    "hair colour": 90,
    "blowout": 30,
    "facial": 60,
    "bridal package": 180,
}

DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']


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
        cur.execute("""
            CREATE TABLE IF NOT EXISTS salon_hours (
                day_of_week  INTEGER PRIMARY KEY,
                open_time    TEXT NOT NULL DEFAULT '10:00',
                close_time   TEXT NOT NULL DEFAULT '19:00',
                is_open      BOOLEAN NOT NULL DEFAULT TRUE
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS closed_dates (
                date    TEXT PRIMARY KEY,
                reason  TEXT DEFAULT ''
            )
        """)
        # Seed default hours once: Mon–Sat open 10:00–19:00, Sunday closed
        cur.execute("SELECT COUNT(*) AS cnt FROM salon_hours")
        if cur.fetchone()['cnt'] == 0:
            for day in range(7):
                cur.execute(
                    """INSERT INTO salon_hours (day_of_week, open_time, close_time, is_open)
                       VALUES (%(day)s, '10:00', '19:00', %(is_open)s)
                       ON CONFLICT (day_of_week) DO NOTHING""",
                    {"day": day, "is_open": day < 6},
                )


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


def _parse_time(t: str) -> Time:
    h, m = map(int, t.split(':'))
    return Time(h, m)


def is_salon_open(dt_iso: str, duration: int) -> tuple[bool, str]:
    """Returns (True, '') if the salon is open, or (False, human-readable reason)."""
    dt = datetime.fromisoformat(dt_iso)
    date_str = dt.strftime('%Y-%m-%d')
    day = dt.weekday()  # 0=Monday … 6=Sunday

    with get_db() as cur:
        cur.execute("SELECT reason FROM closed_dates WHERE date = %(d)s", {"d": date_str})
        closed = cur.fetchone()
        if closed:
            label = closed['reason'] or date_str
            return False, f"The salon is closed on {date_str} ({label})."

        cur.execute(
            "SELECT is_open, open_time, close_time FROM salon_hours WHERE day_of_week = %(day)s",
            {"day": day},
        )
        row = cur.fetchone()

    if not row or not row['is_open']:
        return False, f"The salon is closed on {DAYS[day]}s."

    open_t  = _parse_time(row['open_time'])
    close_t = _parse_time(row['close_time'])
    end_dt  = dt + timedelta(minutes=duration)

    if end_dt.date() > dt.date():
        return False, "Appointment would run past midnight."
    if dt.time() < open_t:
        return False, f"The salon opens at {row['open_time']}."
    if end_dt.time() > close_t:
        return False, f"Appointment would end after closing time ({row['close_time']})."

    return True, ""


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

    open_ok, reason = is_salon_open(dt_iso, duration)
    if not open_ok:
        alternatives = _find_alternatives(dt_iso, duration)
        return {"available": False, "reason": reason, "alternatives": alternatives}

    if not _has_conflict(dt_iso, duration):
        return {"available": True, "service": service, "datetime": dt_iso}

    alternatives = _find_alternatives(dt_iso, duration)
    return {"available": False, "alternatives": alternatives}


def _find_alternatives(from_dt_iso: str, duration: int) -> list[str]:
    start = datetime.fromisoformat(from_dt_iso)
    candidate = start + timedelta(hours=1)
    limit = start + timedelta(days=5)

    # Fetch schedule once for the full search window
    date_list = []
    d = candidate.date()
    while d <= limit.date():
        date_list.append(d.strftime('%Y-%m-%d'))
        d += timedelta(days=1)

    with get_db() as cur:
        cur.execute("SELECT day_of_week, is_open, open_time, close_time FROM salon_hours")
        hours_by_day = {row['day_of_week']: dict(row) for row in cur.fetchall()}
        cur.execute(
            "SELECT date FROM closed_dates WHERE date = ANY(%(dates)s)",
            {"dates": date_list},
        )
        closed_set = {row['date'] for row in cur.fetchall()}

    slots: list[str] = []
    while len(slots) < 3 and candidate < limit:
        date_str = candidate.strftime('%Y-%m-%d')
        h = hours_by_day.get(candidate.weekday(), {})

        if date_str not in closed_set and h.get('is_open'):
            open_t  = _parse_time(h['open_time'])
            close_t = _parse_time(h['close_time'])
            end_dt  = candidate + timedelta(minutes=duration)

            if (
                candidate.time() >= open_t
                and end_dt.date() == candidate.date()
                and end_dt.time() <= close_t
                and not _has_conflict(candidate.isoformat(), duration)
            ):
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


def get_salon_hours() -> list[dict]:
    with get_db() as cur:
        cur.execute("SELECT * FROM salon_hours ORDER BY day_of_week")
        return [dict(r) for r in cur.fetchall()]


def get_closed_dates() -> list[dict]:
    with get_db() as cur:
        cur.execute("SELECT * FROM closed_dates ORDER BY date")
        return [dict(r) for r in cur.fetchall()]


def add_closed_date(date: str, reason: str = "") -> None:
    with get_db() as cur:
        cur.execute(
            """INSERT INTO closed_dates (date, reason) VALUES (%(d)s, %(r)s)
               ON CONFLICT (date) DO UPDATE SET reason = %(r)s""",
            {"d": date, "r": reason},
        )


def remove_closed_date(date: str) -> None:
    with get_db() as cur:
        cur.execute("DELETE FROM closed_dates WHERE date = %(d)s", {"d": date})
