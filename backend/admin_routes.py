"""Private LSD Care admin API.

Integration: in the existing FastAPI app.py, AFTER get_db() and
get_current_user() are defined, add:

    from admin_routes import router as admin_router
    app.include_router(admin_router)

Set LSD_ADMIN_EMAIL in Railway to the one email address allowed to administer
this application. This endpoint checks the signed-in user on the server; the
frontend email check is only for displaying the navigation link.
"""

import os
import sqlite3
from fastapi import APIRouter, Depends, HTTPException

# These functions are defined by your existing app.py authentication/database code.
from app import get_db, get_current_user

router = APIRouter(prefix="/admin", tags=["Admin"])



def require_admin(user=Depends(get_current_user)):
    configured_emails = {
        email.strip().lower()
        for email in os.environ.get(
            "LSD_ADMIN_EMAILS",
            os.environ.get("LSD_ADMIN_EMAIL", "")
        ).split(",")
        if email.strip()
    }

    if not configured_emails:
        raise HTTPException(
            status_code=503,
            detail="Admin access is not configured."
        )

    user_email = str(user["email"]).strip().lower()

    if user_email not in configured_emails:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to access the admin dashboard."
        )

    return user



@router.get("/overview")
def admin_overview(admin=Depends(require_admin)):
    """Return safe user fields and screening totals; never return password hashes."""
    try:
        with get_db() as connection:
            connection.row_factory = sqlite3.Row
            users = connection.execute(
                """SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
                          COUNT(h.id) AS screening_count
                   FROM users AS u
                   LEFT JOIN screening_history AS h ON h.user_id = u.id
                   GROUP BY u.id, u.name, u.email, u.phone, u.role, u.created_at
                   ORDER BY u.created_at DESC"""
            ).fetchall()
            total_screenings = connection.execute(
                "SELECT COUNT(*) FROM screening_history"
            ).fetchone()[0]
    except sqlite3.OperationalError as exc:
        # Clear message if the current deployment has not created history table.
        if "screening_history" in str(exc).lower():
            raise HTTPException(status_code=503, detail="Screening history table is not initialized yet.") from exc
        raise

    safe_users = [
        {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "phone": row["phone"],
            "role": row["role"],
            "created_at": row["created_at"],
            "screening_count": int(row["screening_count"] or 0),
        }
        for row in users
    ]
    return {
        "total_users": len(safe_users),
        "total_screenings": int(total_screenings or 0),
        "users": safe_users,
    }
