"""Email system for AeroVista Airlines. Sending is MOCKED unless EMAIL_ENABLED=true and SMTP creds provided.
All outgoing emails are logged to the `email_logs` collection regardless of sending status.
"""
import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from datetime import datetime, timezone
from typing import Optional, List, Tuple
import uuid

logger = logging.getLogger(__name__)

SMTP_EMAIL = os.environ.get("SMTP_EMAIL", "airlinesaerovista@gmail.com")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
EMAIL_ENABLED = os.environ.get("EMAIL_ENABLED", "false").lower() == "true"


BRAND_FOOTER = """
<hr style="margin-top:24px; border:none; border-top:1px solid #ddd;"/>
<p style="font-family:Outfit, Arial, sans-serif; color:#555; font-size:12px;">
  <strong style="color:#0B132B;">AeroVista Airlines</strong><br/>
  <em style="color:#D4AF37;">Connecting Horizons, Delivering Excellence</em><br/>
  Customer Support: <a href="mailto:airlinesaerovista@gmail.com" style="color:#0B132B;">airlinesaerovista@gmail.com</a><br/>
  Thank you for choosing AeroVista Airlines.
</p>
"""


def _wrap_template(title: str, body_html: str) -> str:
    return f"""<!DOCTYPE html><html><body style="margin:0; padding:0; background:#f5f5f5;">
  <div style="max-width:640px; margin:0 auto; background:#ffffff; font-family:Outfit, Arial, sans-serif;">
    <div style="background:#0B132B; color:#D4AF37; padding:28px 32px;">
      <h1 style="margin:0; font-size:24px; letter-spacing:1px;">AeroVista Airlines</h1>
      <p style="margin:4px 0 0; font-size:12px; color:#F3E5AB;">Connecting Horizons, Delivering Excellence</p>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#0B132B; font-weight:600;">{title}</h2>
      {body_html}
      {BRAND_FOOTER}
    </div>
  </div></body></html>"""


# ===== Template builders =====
def tpl_welcome(name: str) -> Tuple[str, str]:
    return ("Welcome to AeroVista Airlines",
            _wrap_template("Welcome aboard, " + name,
                           "<p>Your journey with AeroVista begins now. Search flights, earn SkyChip loyalty points "
                           "and enjoy world-class service across 120+ destinations.</p>"))


def tpl_booking_confirmation(pnr: str, route: str, date: str, name: str) -> Tuple[str, str]:
    return (f"Booking Confirmed • PNR {pnr}",
            _wrap_template(f"Booking Confirmed, {name}",
                           f"<p>Your booking for <strong>{route}</strong> on <strong>{date}</strong> is confirmed.</p>"
                           f"<p style='font-size:18px;'>PNR: <strong style='color:#D4AF37;'>{pnr}</strong></p>"
                           "<p>Your e-ticket is attached to this email. Web check-in opens 24h before departure.</p>"))


def tpl_ticket_delivery(pnr: str) -> Tuple[str, str]:
    return (f"E-Ticket • PNR {pnr}",
            _wrap_template("Your E-Ticket",
                           f"<p>Please find your e-ticket for PNR <strong>{pnr}</strong> attached.</p>"))


def tpl_invoice_delivery(invoice_no: str) -> Tuple[str, str]:
    return (f"Invoice {invoice_no}",
            _wrap_template("Tax Invoice",
                           f"<p>Your tax invoice <strong>{invoice_no}</strong> is attached for your records.</p>"))


def tpl_receipt_delivery(receipt_no: str) -> Tuple[str, str]:
    return (f"Payment Receipt {receipt_no}",
            _wrap_template("Payment Receipt",
                           f"<p>We have received your payment. Receipt <strong>{receipt_no}</strong> is attached.</p>"))


def tpl_boarding_pass(pnr: str, seat: str) -> Tuple[str, str]:
    return (f"Boarding Pass • PNR {pnr}",
            _wrap_template("Your Boarding Pass",
                           f"<p>Check-in successful! Seat <strong>{seat}</strong> confirmed. "
                           "Boarding pass attached.</p>"))


def tpl_reminder(hours: int, pnr: str, route: str, time: str) -> Tuple[str, str]:
    return (f"Flight Reminder ({hours}h) • {pnr}",
            _wrap_template(f"Reminder: {hours} hours to go",
                           f"<p>Your flight {route} departs at <strong>{time}</strong>. "
                           f"PNR: <strong>{pnr}</strong>. Please reach the airport on time.</p>"))


def tpl_cancellation(pnr: str) -> Tuple[str, str]:
    return (f"Cancellation Confirmed • {pnr}",
            _wrap_template("Booking Cancelled",
                           f"<p>Your booking <strong>{pnr}</strong> has been cancelled. A refund request has been initiated.</p>"))


def tpl_refund(refund_id: str, amount: float, status: str) -> Tuple[str, str]:
    return (f"Refund Update • {refund_id}",
            _wrap_template("Refund Status",
                           f"<p>Refund <strong>{refund_id}</strong> for INR <strong>{amount:.2f}</strong> "
                           f"is now <strong>{status}</strong>.</p>"))


def tpl_reschedule(pnr: str) -> Tuple[str, str]:
    return (f"Flight Reschedule • {pnr}",
            _wrap_template("Reschedule Confirmed",
                           f"<p>Your booking <strong>{pnr}</strong> has been rescheduled. Updated e-ticket attached.</p>"))


# ===== Sender with DB logging =====
async def send_email(db, to_email: str, subject: str, html_body: str,
                     attachments: Optional[List[Tuple[str, bytes]]] = None,
                     category: str = "general") -> dict:
    log_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    log = {
        "id": log_id,
        "to_email": to_email,
        "subject": subject,
        "category": category,
        "status": "pending",
        "error_message": "",
        "sent_at": None,
        "created_at": now,
        "has_attachments": bool(attachments),
        "attachment_count": len(attachments or []),
    }

    if not EMAIL_ENABLED or not SMTP_PASSWORD:
        log["status"] = "mocked"
        log["sent_at"] = now
        log["error_message"] = "EMAIL_ENABLED=false or SMTP_PASSWORD missing"
        await db.email_logs.insert_one(log.copy())
        logger.info(f"[MOCKED EMAIL] to={to_email} subject={subject}")
        return log

    try:
        msg = MIMEMultipart()
        msg["From"] = f"AeroVista Airlines <{SMTP_EMAIL}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html"))
        for fname, data in (attachments or []):
            part = MIMEApplication(data, _subtype="pdf")
            part.add_header("Content-Disposition", "attachment", filename=fname)
            msg.attach(part)
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as s:
            s.starttls()
            s.login(SMTP_EMAIL, SMTP_PASSWORD)
            s.send_message(msg)
        log["status"] = "sent"
        log["sent_at"] = datetime.now(timezone.utc).isoformat()
    except Exception as e:
        log["status"] = "failed"
        log["error_message"] = str(e)
        logger.error(f"Email send failed: {e}")

    await db.email_logs.insert_one(log.copy())
    return log
