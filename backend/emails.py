"""AeroVista Airlines - Email Dispatch Handler.
Routes transaction notifications over Resend HTTP REST API 
to cleanly bypass cloud platform port 587/465 firewall restrictions.
"""
import os
import logging
import requests
from datetime import datetime, timezone
import secrets

logger = logging.getLogger(__name__)

async def send_email(db, to_email: str, subject: str, body: str, attachments=None, category="general"):
    """Dispatches email payloads to the target recipient over secure Port 443 HTTPS.
    
    Bypasses traditional SMTP protocol blocks on cloud providers like Render.
    Logs transaction tracking metrics in the `email_logs` database collection.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    gen_id = lambda: secrets.token_hex(12)
    
    # 1. Fallback Rule: If globally disabled, store as a mocked transaction log entries
    if os.environ.get("EMAIL_ENABLED") != "true":
        log_entry = {
            "id": gen_id(),
            "to_email": to_email,
            "subject": subject,
            "category": category,
            "status": "mocked",
            "error_message": "EMAIL_ENABLED environment flag is not explicitly set to true.",
            "created_at": now_iso,
            "sent_at": None,
            "has_attachments": bool(attachments),
            "attachment_count": len(attachments) if attachments else 0
        }
        await db.email_logs.insert_one(log_entry)
        logger.info(f"Email delivery mocked for {to_email} (EMAIL_ENABLED=false)")
        return log_entry

    # 2. Check for missing configuration keys
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        log_entry = {
            "id": gen_id(),
            "to_email": to_email,
            "subject": subject,
            "category": category,
            "status": "failed",
            "error_message": "Missing RESEND_API_KEY inside platform environment configuration panel.",
            "created_at": now_iso,
            "sent_at": None,
            "has_attachments": bool(attachments),
            "attachment_count": len(attachments) if attachments else 0
        }
        await db.email_logs.insert_one(log_entry)
        logger.error("Email delivery failed: RESEND_API_KEY environment variable missing.")
        return log_entry

    try:
        # Convert plain text newlines to clean HTML paragraph structures
        html_content = body.replace("\n", "<br>")
        
        # 3. Fire secure API request payload over standard Port 443
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": "AeroVista Airlines <onboarding@resend.dev>",
                "to": to_email,
                "subject": subject,
                "html": f"<div style='font-family: sans-serif; color: #111; padding: 20px;'>{html_content}</div>",
            },
            timeout=10
        )
        
        # 4. Handle response verification validation
        if response.status_code in (200, 201):
            log_entry = {
                "id": gen_id(),
                "to_email": to_email,
                "subject": subject,
                "category": category,
                "status": "sent",
                "error_message": None,
                "created_at": now_iso,
                "sent_at": now_iso,
                "has_attachments": bool(attachments),
                "attachment_count": len(attachments) if attachments else 0
            }
            logger.info(f"Email successfully dispatched to {to_email} via Resend API API.")
        else:
            error_msg = f"API Error Code {response.status_code}: {response.text}"
            log_entry = {
                "id": gen_id(),
                "to_email": to_email,
                "subject": subject,
                "category": category,
                "status": "failed",
                "error_message": error_msg,
                "created_at": now_iso,
                "sent_at": None,
                "has_attachments": bool(attachments),
                "attachment_count": len(attachments) if attachments else 0
            }
            logger.error(f"Resend communication pipeline failure: {error_msg}")
            
    except Exception as e:
        log_entry = {
            "id": gen_id(),
            "to_email": to_email,
            "subject": subject,
            "category": category,
            "status": "failed",
            "error_message": f"Network exception layer error: {str(e)}",
            "created_at": now_iso,
            "sent_at": None,
            "has_attachments": bool(attachments),
            "attachment_count": len(attachments) if attachments else 0
        }
        logger.exception("Outbound email processing encountered an unexpected trace error.")

    # 5. Commit record status inside database document storage tracking collection
    await db.email_logs.insert_one(log_entry)
    return log_entry


# ===== Template Placeholders to keep backward compatibility =====
def tpl_welcome(name: str) -> tuple:
    subject = "Welcome to AeroVista Airlines"
    body = f"Dear {name},\n\nWelcome to AeroVista Airlines. Your premium flight portal account has been successfully configured.\n\nBest regards,\nAeroVista Executive Team"
    return subject, body

def tpl_booking_confirmation(pnr: str, route: str, date: str, name: str) -> tuple:
    subject = f"Booking Confirmed • PNR {pnr}"
    body = f"Dear {name},\n\nYour flight reservation is officially confirmed.\n\nPNR: {pnr}\nRoute: {route}\nDate: {date}\n\nYour e-tickets and payment receipt have been generated.\n\nSafe skies,\nAeroVista Airlines"
    return subject, body

def tpl_password_reset(name: str, link: str) -> tuple:
    subject = "Reset Your AeroVista Account Password"
    body = f"Dear {name},\n\nWe received a request to reset your password. Use the secure credential validation link below to finalize this transaction:\n\n{link}\n\nThis security link expires in 30 minutes.\n\nRegards,\nAeroVista Cyber Security team"
    return subject, body

def tpl_pre_departure_upsell(name: str, pnr: str, route: str, date: str, time: str, link: str) -> tuple:
    subject = f"Upgrade Your Upcoming AeroVista Journey • PNR {pnr}"
    body = f"Dear {name},\n\nYour flight {route} is scheduled to depart on {date} at {time}.\n\nExplore exclusive cabin upgrades and lounge accesses directly inside your account:\n{link}\n\nFly in ultimate comfort,\nAeroVista Luxury Service Team"
    return subject, body
