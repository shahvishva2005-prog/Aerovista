"""AeroVista Airlines - Email Dispatch Handler.
Routes transaction notifications over Resend HTTP REST API using standard built-in 
libraries to eliminate external dependencies and bypass platform port blocks.
"""
import os
import logging
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone
import secrets

logger = logging.getLogger(__name__)

async def send_email(db, to_email: str, subject: str, body: str, attachments=None, category="general"):
    """Dispatches email payloads to the target recipient over secure Port 443 HTTPS.
    
    Uses Python's built-in urllib to guarantee compatibility without requiring extra packages.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    gen_id = lambda: secrets.token_hex(12)
    
    # 1. Fallback Rule: If globally disabled, store as a mocked transaction log
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
        return log_entry

    try:
        # Convert plain text newlines to clean HTML paragraph structures
        html_content = body.replace("\n", "<br>")
        
        # Prepare payload data dictionary matching exact Resend sandbox rules
        payload = {
            "from": "onboarding@resend.dev",
            "to": [to_email.strip()],
            "subject": str(subject),
            "html": f"<div style='font-family: sans-serif; color: #111; padding: 20px;'>{html_content}</div>"
        }
        
        data = json.dumps(payload).encode("utf-8")
        
        # 3. Build secure urllib Request over standard Port 443 HTTPS
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=data,
            headers={
                "Authorization": f"Bearer {api_key.strip()}",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        
        # 4. Fire network request safely
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read().decode("utf-8")
            if response.status in (200, 201, 202):
                log_entry = {
                    "id": gen_id(), "to_email": to_email, "subject": subject, "category": category,
                    "status": "sent", "error_message": None, "created_at": now_iso, "sent_at": now_iso,
                    "has_attachments": bool(attachments), "attachment_count": len(attachments) if attachments else 0
                }
            else:
                raise Exception(f"Unexpected status code {response.status}: {res_body}")
                
    except urllib.error.HTTPError as e:
        error_text = e.read().decode("utf-8")
        log_entry = {
            "id": gen_id(), "to_email": to_email, "subject": subject, "category": category,
            "status": "failed", "error_message": f"HTTP Error {e.code}: {error_text}", "created_at": now_iso,
            "sent_at": None, "has_attachments": bool(attachments), "attachment_count": len(attachments) if attachments else 0
        }
    except Exception as e:
        log_entry = {
            "id": gen_id(), "to_email": to_email, "subject": subject, "category": category,
            "status": "failed", "error_message": str(e), "created_at": now_iso,
            "sent_at": None, "has_attachments": bool(attachments), "attachment_count": len(attachments) if attachments else 0
        }

    # 5. Commit record status inside database tracking collection
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
