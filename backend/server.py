"""AeroVista Airlines - FastAPI backend.
All routes are mounted under /api. Uses MongoDB via Motor.
"""
import os
import io
import random
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, Body
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from models import (
    RegisterReq, LoginReq, TokenRes, FlightSearchReq,
    CreateBookingReq, PaymentReq, RefundReq, RescheduleReq, CheckInReq, TrackReq,
    gen_id, now_iso,
)
from auth import hash_password, verify_password, create_token, get_current_user, require_roles
from data.airports import AIRPORTS, airport_by_iata
import emails as email_mod
import pdfs as pdf_mod

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="AeroVista Airlines API")
api = APIRouter(prefix="/api")

# ===== Helpers =====
PROJECT_NO_ID = {"_id": 0}


def _haversine_minutes(o_city: str, d_city: str) -> int:
    """Rough flight time estimate based on city distance lookup (simplified)."""
    base = abs(hash(o_city + d_city)) % 540 + 90  # 90 - 630 minutes
    return base


def _fmt_duration(mins: int) -> str:
    return f"{mins // 60}h {mins % 60:02d}m"


def _calc_dynamic_price(base: float, departure_dt: datetime, seats_left_ratio: float) -> tuple:
    """Compute dynamic price + reasons list."""
    reasons = []
    price = base
    # Demand based - higher for weekend
    if departure_dt.weekday() in (4, 5, 6):
        price *= 1.15
        reasons.append({"label": "Weekend Demand", "factor": "+15%"})
    # Last-minute booking surcharge
    delta_days = (departure_dt.date() - datetime.now(timezone.utc).date()).days
    if delta_days <= 3:
        price *= 1.20
        reasons.append({"label": "Last-minute Booking", "factor": "+20%"})
    elif delta_days <= 14:
        price *= 1.08
        reasons.append({"label": "Peak Window", "factor": "+8%"})
    # Festival proxy: Dec/Mar
    if departure_dt.month in (12, 3):
        price *= 1.10
        reasons.append({"label": "Festival Season", "factor": "+10%"})
    # Seat availability
    if seats_left_ratio < 0.2:
        price *= 1.25
        reasons.append({"label": "Low Seat Availability", "factor": "+25%"})
    elif seats_left_ratio < 0.4:
        price *= 1.10
        reasons.append({"label": "Limited Seats", "factor": "+10%"})
    if not reasons:
        reasons.append({"label": "Base Fare", "factor": "Standard"})
    return round(price, 2), reasons


# ===== Seed Endpoint =====
@api.post("/admin/seed")
async def admin_seed(force: bool = False):
    """Seed initial data: admin/pilot/crew users, flights, sample bookings."""
    existing = await db.users.count_documents({})
    if existing > 0 and not force:
        return {"message": "Already seeded", "users": existing}

    if force:
        for coll in ["users", "flights", "aircraft", "pilots", "cabin_crew",
                     "bookings", "payments", "refunds", "email_logs",
                     "notifications", "loyalty", "audit_logs"]:
            await db[coll].delete_many({})

    now = datetime.now(timezone.utc)

    # ===== Users =====
    admin = {
        "id": gen_id(), "name": "Admin AeroVista", "email": "admin@aerovista.com",
        "password_hash": hash_password("Admin@123"), "role": "admin",
        "mobile": "+91 9000000001", "created_at": now.isoformat(),
    }
    pilot_user = {
        "id": gen_id(), "name": "Captain Rajiv Mehta", "email": "pilot@aerovista.com",
        "password_hash": hash_password("Pilot@123"), "role": "pilot",
        "mobile": "+91 9000000002", "created_at": now.isoformat(),
    }
    crew_user = {
        "id": gen_id(), "name": "Anika Sharma", "email": "crew@aerovista.com",
        "password_hash": hash_password("Crew@123"), "role": "crew",
        "mobile": "+91 9000000003", "created_at": now.isoformat(),
    }
    customer = {
        "id": gen_id(), "name": "Test Customer", "email": "customer@aerovista.com",
        "password_hash": hash_password("Customer@123"), "role": "customer",
        "mobile": "+91 9000000004", "created_at": now.isoformat(),
        "loyalty_tier": "Silver", "loyalty_points": 2400,
    }
    await db.users.insert_many([admin, pilot_user, crew_user, customer])

    # ===== Aircraft =====
    aircraft_models = [
        {"model": "Boeing 737-800", "capacity": 180, "ranges_km": 5400},
        {"model": "Boeing 777-300ER", "capacity": 396, "ranges_km": 13650},
        {"model": "Boeing 787-9 Dreamliner", "capacity": 290, "ranges_km": 14140},
        {"model": "Airbus A320neo", "capacity": 186, "ranges_km": 6500},
        {"model": "Airbus A350-900", "capacity": 325, "ranges_km": 15000},
    ]
    aircraft_docs = []
    for i, m in enumerate(aircraft_models, 1):
        for tail in range(1, 4):
            aircraft_docs.append({
                "id": gen_id(),
                "registration": f"VT-AV{i}{tail:02d}",
                "model": m["model"],
                "capacity": m["capacity"],
                "range_km": m["ranges_km"],
                "status": random.choice(["available", "available", "available", "maintenance"]),
                "manufactured_year": 2018 + (i % 5),
            })
    await db.aircraft.insert_many(aircraft_docs)

    # ===== Pilots & Crew records =====
    pilot_names = ["Vikram Singh", "Aarav Patel", "Rohan Nair", "Karan Kapoor",
                   "Aditya Bose", "Sahil Khanna", "Mihir Joshi", "Arjun Reddy",
                   "Dev Malhotra", "Ishaan Verma"]
    pilots = []
    for i, n in enumerate(pilot_names, 1):
        pilots.append({
            "id": gen_id(),
            "employee_id": f"PIL{i:04d}",
            "name": n,
            "rank": random.choice(["Captain", "First Officer", "Senior Captain"]),
            "flight_hours": random.randint(2000, 18000),
            "license_no": f"DGCA-{1000+i}",
            "base": random.choice(["DEL", "BOM", "BLR", "HYD"]),
            "status": "active",
        })
    await db.pilots.insert_many(pilots)

    crew_names = ["Priya Iyer", "Neha Gupta", "Tanya Bose", "Sneha Roy", "Riya Das",
                  "Aanya Khan", "Meera Pillai", "Anvi Shah", "Diya Chopra", "Kriti Sen"]
    crew_docs = []
    for i, n in enumerate(crew_names, 1):
        crew_docs.append({
            "id": gen_id(),
            "employee_id": f"CRW{i:04d}",
            "name": n,
            "role": random.choice(["Cabin Senior", "Flight Attendant", "Purser"]),
            "languages": random.sample(["English", "Hindi", "French", "Arabic", "Mandarin"], 3),
            "base": random.choice(["DEL", "BOM", "BLR"]),
            "status": "active",
        })
    await db.cabin_crew.insert_many(crew_docs)

    # ===== Flights (next 30 days, popular routes) =====
    routes = [
        ("DEL", "BOM"), ("DEL", "BLR"), ("BOM", "GOI"), ("DEL", "DXB"), ("BOM", "DXB"),
        ("DEL", "LHR"), ("BOM", "SIN"), ("DEL", "JFK"), ("BLR", "SIN"), ("DEL", "BKK"),
        ("HYD", "DEL"), ("MAA", "BOM"), ("BLR", "DEL"), ("DEL", "CDG"), ("BOM", "FRA"),
        ("DEL", "HKG"), ("BOM", "DOH"), ("DEL", "AUH"), ("BLR", "BOM"), ("CCU", "DEL"),
    ]
    flights = []
    for r_idx, (org, dst) in enumerate(routes):
        for d in range(0, 30):
            for sched in [(7, 30), (13, 15), (19, 45)]:
                dep_dt = (now + timedelta(days=d)).replace(hour=sched[0], minute=sched[1], second=0, microsecond=0)
                duration = _haversine_minutes(org, dst)
                arr_dt = dep_dt + timedelta(minutes=duration)
                aircraft = random.choice(aircraft_docs)
                base = random.choice([3499, 4299, 5499, 7299, 8999, 12499, 18999])
                if "DXB" in (org, dst) or "LHR" in (org, dst) or "JFK" in (org, dst) or "SIN" in (org, dst):
                    base = random.choice([18999, 24999, 32999, 42999])
                o_air = airport_by_iata(org) or {}
                d_air = airport_by_iata(dst) or {}
                flight = {
                    "id": gen_id(),
                    "flight_number": f"AV{1000 + r_idx * 50 + d * 3 + sched[0]:04d}",
                    "origin": org, "origin_city": o_air.get("city", org),
                    "destination": dst, "destination_city": d_air.get("city", dst),
                    "departure_date": dep_dt.date().isoformat(),
                    "departure_time": dep_dt.strftime("%H:%M"),
                    "arrival_date": arr_dt.date().isoformat(),
                    "arrival_time": arr_dt.strftime("%H:%M"),
                    "departure_iso": dep_dt.isoformat(),
                    "arrival_iso": arr_dt.isoformat(),
                    "duration_mins": duration,
                    "duration": _fmt_duration(duration),
                    "aircraft": aircraft["model"],
                    "aircraft_id": aircraft["id"],
                    "terminal": random.choice(["T1", "T2", "T3"]),
                    "gate": random.choice(["A12", "B07", "C22", "D15", "E03"]),
                    "boarding_time": (dep_dt - timedelta(minutes=40)).strftime("%H:%M"),
                    "base_price": base,
                    "total_seats": aircraft["capacity"],
                    "available_seats": aircraft["capacity"] - random.randint(0, aircraft["capacity"] // 3),
                    "status": "scheduled",
                    "pilot_id": random.choice(pilots)["id"],
                    "crew_ids": [c["id"] for c in random.sample(crew_docs, 4)],
                }
                flights.append(flight)
    # Insert in batches
    if flights:
        await db.flights.insert_many(flights)

    return {
        "message": "Seeded",
        "users": 4,
        "aircraft": len(aircraft_docs),
        "pilots": len(pilots),
        "crew": len(crew_docs),
        "flights": len(flights),
    }


# ===== Public =====
@api.get("/")
async def root():
    return {"app": "AeroVista Airlines API", "status": "ok"}


@api.get("/airports")
async def list_airports(q: Optional[str] = None):
    if not q:
        return AIRPORTS
    qq = q.lower()
    return [a for a in AIRPORTS if qq in a["iata"].lower() or qq in a["city"].lower() or qq in a["country"].lower()][:50]


@api.get("/stats")
async def public_stats():
    return {
        "passengers": "2.5M+",
        "flights_completed": "185,000+",
        "aircraft": "85+",
        "pilots": "320+",
        "cabin_crew": "780+",
        "countries": "45+",
        "destinations": "120+",
        "satisfaction": "98.7%",
    }


# ===== Auth =====
@api.post("/auth/register", response_model=TokenRes)
async def register(req: RegisterReq):
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": gen_id(),
        "name": req.name,
        "email": req.email.lower(),
        "password_hash": hash_password(req.password),
        "role": "customer",
        "mobile": req.mobile or "",
        "created_at": now_iso(),
        "loyalty_tier": "Bronze",
        "loyalty_points": 0,
    }
    await db.users.insert_one(user)
    token = create_token({"sub": user["id"], "role": "customer"})
    safe = {k: v for k, v in user.items() if k not in ("password_hash", "_id")}
    # welcome email (mocked)
    subj, body = email_mod.tpl_welcome(req.name)
    await email_mod.send_email(db, req.email, subj, body, category="welcome")
    return TokenRes(access_token=token, user=safe)


@api.post("/auth/login", response_model=TokenRes)
async def login(req: LoginReq):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token({"sub": user["id"], "role": user["role"]})
    safe = {k: v for k, v in user.items() if k not in ("password_hash", "_id")}
    return TokenRes(access_token=token, user=safe)


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# ===== Flights =====
@api.post("/flights/search")
async def search_flights(req: FlightSearchReq):
    query = {
        "origin": req.origin.upper(),
        "destination": req.destination.upper(),
        "departure_date": req.departure_date,
    }
    flights = await db.flights.find(query, PROJECT_NO_ID).sort("departure_time", 1).to_list(100)
    # Apply dynamic pricing per flight
    enriched = []
    for f in flights:
        dep_dt = datetime.fromisoformat(f["departure_iso"])
        ratio = (f.get("available_seats", 1) or 1) / max(1, f.get("total_seats", 1))
        # cabin multiplier
        mult = {"economy": 1.0, "premium_economy": 1.6, "business": 2.8, "first": 4.5}.get(req.cabin_class, 1.0)
        base = f["base_price"] * mult
        price, reasons = _calc_dynamic_price(base, dep_dt, ratio)
        f["price"] = price
        f["price_reasons"] = reasons
        f["cabin_class"] = req.cabin_class
        enriched.append(f)

    return {"outbound": enriched, "return": [], "trip_type": req.trip_type, "passengers": req.passengers}


@api.get("/flights/{flight_id}")
async def flight_detail(flight_id: str):
    f = await db.flights.find_one({"id": flight_id}, PROJECT_NO_ID)
    if not f:
        raise HTTPException(status_code=404, detail="Flight not found")
    # seat map: generate 30 rows x 6 columns
    rows = 30
    cols = ["A", "B", "C", "D", "E", "F"]
    occupied = set(random.sample([f"{r}{c}" for r in range(1, rows + 1) for c in cols], k=min(60, rows * 6 // 2)))
    seat_map = []
    for r in range(1, rows + 1):
        for c in cols:
            seat = f"{r}{c}"
            seat_type = "economy"
            if r <= 2:
                seat_type = "first"
            elif r <= 5:
                seat_type = "business"
            elif r <= 8:
                seat_type = "premium_economy"
            state = "occupied" if seat in occupied else "available"
            extra_price = 0
            if seat_type == "premium_economy":
                extra_price = 800
            elif seat_type == "business":
                extra_price = 4500
            elif seat_type == "first":
                extra_price = 9500
            elif c in ("A", "F"):  # window
                extra_price = 200
            seat_map.append({"seat": seat, "row": r, "col": c, "type": seat_type,
                             "state": state, "extra_price": extra_price})
    f["seat_map"] = seat_map
    return f


# ===== Booking =====
def _gen_codes(prefix: str, n: int = 6) -> str:
    import secrets, string
    alphabet = string.ascii_uppercase + string.digits
    return prefix + "".join(secrets.choice(alphabet) for _ in range(n))


@api.post("/bookings")
async def create_booking(req: CreateBookingReq, user=Depends(get_current_user)):
    flight = await db.flights.find_one({"id": req.flight_id}, PROJECT_NO_ID)
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    # Recompute pricing
    dep_dt = datetime.fromisoformat(flight["departure_iso"])
    ratio = (flight.get("available_seats", 1) or 1) / max(1, flight.get("total_seats", 1))
    mult = {"economy": 1.0, "premium_economy": 1.6, "business": 2.8, "first": 4.5}.get(req.cabin_class, 1.0)
    base_per_pax, _ = _calc_dynamic_price(flight["base_price"] * mult, dep_dt, ratio)
    n_pax = len(req.passengers)
    base = round(base_per_pax * n_pax, 2)
    addons = 0
    if req.add_baggage:
        addons += 800 * n_pax
    if req.add_insurance:
        addons += 250 * n_pax
    # meals
    addons += 350 * len([m for m in req.meal_preferences if m and m != "standard"])

    discount = 0
    promo = (req.promo_code or "").upper().strip()
    if promo == "HDFC10":
        discount = round(base * 0.10, 2)
    elif promo == "ICICI200":
        discount = 200
    elif promo == "AXIS5":
        discount = round(base * 0.05, 2)
    elif promo == "SBI500":
        discount = 500

    tax_rate = 0.05 if req.cabin_class == "economy" else 0.12
    taxes = round((base + addons - discount) * tax_rate, 2)
    convenience = 50
    total = round(base + addons - discount + taxes + convenience, 2)

    booking = {
        "id": gen_id(),
        "user_id": user["id"],
        "user_email": user["email"],
        "flight_id": flight["id"],
        "flight_snapshot": flight,
        "cabin_class": req.cabin_class,
        "passengers": [p.model_dump() for p in req.passengers],
        "seats": req.seat_numbers or [],
        "meals": req.meal_preferences or [],
        "add_baggage": req.add_baggage,
        "add_insurance": req.add_insurance,
        "billing": req.billing.model_dump(),
        "pnr": _gen_codes("AV", 6),
        "ticket_number": _gen_codes("TKT", 9),
        "invoice_number": _gen_codes("INV", 8),
        "receipt_number": _gen_codes("RCP", 8),
        "boarding_pass_number": _gen_codes("BP", 7),
        "fare": {
            "base": base, "base_per_pax": base_per_pax, "addons": addons,
            "discount": discount, "taxes": taxes, "convenience": convenience, "total": total,
        },
        "status": "pending_payment",
        "payment_status": "pending",
        "checked_in": False,
        "booked_at": now_iso(),
    }
    await db.bookings.insert_one(booking.copy())

    # Decrement seat availability
    await db.flights.update_one({"id": flight["id"]}, {"$inc": {"available_seats": -n_pax}})

    safe_booking = {k: v for k, v in booking.items() if k != "_id"}
    return safe_booking


@api.post("/bookings/{booking_id}/pay")
async def pay_booking(booking_id: str, req: PaymentReq, user=Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": booking_id, "user_id": user["id"]}, PROJECT_NO_ID)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["payment_status"] == "paid":
        raise HTTPException(status_code=400, detail="Already paid")
    amount = booking["fare"]["total"]
    payment = {
        "id": gen_id(),
        "booking_id": booking_id,
        "user_id": user["id"],
        "transaction_id": _gen_codes("TXN", 10),
        "method": req.method,
        "amount": amount,
        "currency": "INR",
        "status": "success",  # dummy gateway always success
        "bank": req.bank,
        "card_last4": req.card_number_last4,
        "upi_id": req.upi_id,
        "paid_at": now_iso(),
    }
    await db.payments.insert_one(payment.copy())
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"payment_status": "paid", "status": "confirmed", "paid_at": payment["paid_at"]}},
    )
    # Loyalty points
    points = int(amount // 100)
    await db.users.update_one({"id": user["id"]}, {"$inc": {"loyalty_points": points}})

    # Email confirmation (mocked)
    booking_after = await db.bookings.find_one({"id": booking_id}, PROJECT_NO_ID)
    flight = booking_after["flight_snapshot"]
    pdfs_attached = []
    try:
        ticket_pdf = pdf_mod.generate_ticket_pdf(booking_after, flight, booking_after["passengers"])
        invoice_pdf = pdf_mod.generate_invoice_pdf(booking_after, flight, booking_after["passengers"])
        receipt_pdf = pdf_mod.generate_receipt_pdf(payment, booking_after)
        pdfs_attached = [
            (f"eticket-{booking_after['pnr']}.pdf", ticket_pdf),
            (f"invoice-{booking_after['invoice_number']}.pdf", invoice_pdf),
            (f"receipt-{booking_after['receipt_number']}.pdf", receipt_pdf),
        ]
    except Exception as e:
        logger.warning(f"PDF gen on pay error: {e}")
    subj, body = email_mod.tpl_booking_confirmation(
        booking_after["pnr"], f"{flight['origin']} → {flight['destination']}",
        flight["departure_date"], user["name"])
    await email_mod.send_email(db, user["email"], subj, body, attachments=pdfs_attached,
                               category="booking_confirmation")

    payment_safe = {k: v for k, v in payment.items() if k != "_id"}
    return {"payment": payment_safe, "booking_id": booking_id, "pnr": booking_after["pnr"],
            "points_earned": points}


@api.get("/bookings/mine")
async def my_bookings(user=Depends(get_current_user)):
    items = await db.bookings.find({"user_id": user["id"]}, PROJECT_NO_ID).sort("booked_at", -1).to_list(200)
    return items


@api.get("/bookings/{booking_id}")
async def booking_detail(booking_id: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, PROJECT_NO_ID)
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    if b["user_id"] != user["id"] and user.get("role") not in ("admin",):
        raise HTTPException(status_code=403, detail="Forbidden")
    return b


# ===== PDFs =====
@api.get("/bookings/{booking_id}/ticket.pdf")
async def download_ticket(booking_id: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, PROJECT_NO_ID)
    if not b or (b["user_id"] != user["id"] and user.get("role") != "admin"):
        raise HTTPException(status_code=404, detail="Not found")
    data = pdf_mod.generate_ticket_pdf(b, b["flight_snapshot"], b["passengers"])
    return StreamingResponse(io.BytesIO(data), media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=eticket-{b['pnr']}.pdf"})


@api.get("/bookings/{booking_id}/invoice.pdf")
async def download_invoice(booking_id: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, PROJECT_NO_ID)
    if not b or (b["user_id"] != user["id"] and user.get("role") != "admin"):
        raise HTTPException(status_code=404, detail="Not found")
    data = pdf_mod.generate_invoice_pdf(b, b["flight_snapshot"], b["passengers"])
    return StreamingResponse(io.BytesIO(data), media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=invoice-{b['invoice_number']}.pdf"})


@api.get("/bookings/{booking_id}/receipt.pdf")
async def download_receipt(booking_id: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, PROJECT_NO_ID)
    if not b or (b["user_id"] != user["id"] and user.get("role") != "admin"):
        raise HTTPException(status_code=404, detail="Not found")
    payment = await db.payments.find_one({"booking_id": booking_id}, PROJECT_NO_ID) or {}
    data = pdf_mod.generate_receipt_pdf(payment, b)
    return StreamingResponse(io.BytesIO(data), media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=receipt-{b['receipt_number']}.pdf"})


@api.get("/bookings/{booking_id}/boarding-pass.pdf")
async def download_boarding(booking_id: str, passenger_idx: int = 0, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, PROJECT_NO_ID)
    if not b or (b["user_id"] != user["id"] and user.get("role") != "admin"):
        raise HTTPException(status_code=404, detail="Not found")
    if passenger_idx >= len(b["passengers"]):
        raise HTTPException(status_code=400, detail="Invalid passenger index")
    seat = b["seats"][passenger_idx] if passenger_idx < len(b["seats"]) else "TBA"
    data = pdf_mod.generate_boarding_pass_pdf(b, b["flight_snapshot"], b["passengers"][passenger_idx], seat)
    return StreamingResponse(io.BytesIO(data), media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=boarding-{b['pnr']}-{passenger_idx+1}.pdf"})


# ===== Track / Check-in =====
@api.post("/track")
async def track(req: TrackReq):
    query = {}
    if req.pnr:
        query["pnr"] = req.pnr.upper()
    if req.email:
        query["user_email"] = req.email.lower()
    if req.mobile:
        query["billing.contact_mobile"] = req.mobile
    if not query:
        raise HTTPException(status_code=400, detail="Provide PNR, email, or mobile")
    items = await db.bookings.find(query, PROJECT_NO_ID).to_list(20)
    return items


@api.post("/checkin")
async def checkin(req: CheckInReq):
    b = await db.bookings.find_one({"pnr": req.pnr.upper()}, PROJECT_NO_ID)
    if not b:
        raise HTTPException(status_code=404, detail="PNR not found")
    # Validate last name match for any pax
    found = any(p["last_name"].lower() == req.last_name.lower() for p in b["passengers"])
    if not found:
        raise HTTPException(status_code=400, detail="Last name mismatch")
    # Check time window
    dep_dt = datetime.fromisoformat(b["flight_snapshot"]["departure_iso"])
    now = datetime.now(timezone.utc)
    if dep_dt - now > timedelta(hours=24):
        raise HTTPException(status_code=400, detail="Web check-in opens 24 hours before departure")
    if dep_dt - now < timedelta(minutes=60):
        raise HTTPException(status_code=400, detail="Web check-in closes 60 minutes before departure")
    await db.bookings.update_one({"id": b["id"]}, {"$set": {"checked_in": True, "checkin_at": now_iso()}})
    return {"ok": True, "booking_id": b["id"], "pnr": b["pnr"], "passengers": b["passengers"], "seats": b["seats"]}


# ===== Refund & Reschedule =====
@api.post("/refunds")
async def request_refund(req: RefundReq, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": req.booking_id, "user_id": user["id"]}, PROJECT_NO_ID)
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    if b["payment_status"] != "paid":
        raise HTTPException(status_code=400, detail="Booking is not paid")
    cnt = await db.refunds.count_documents({})
    refund = {
        "id": gen_id(),
        "refund_id": f"RFD{cnt + 1:06d}",
        "booking_id": req.booking_id,
        "pnr": b["pnr"],
        "user_id": user["id"],
        "amount": round(b["fare"]["total"] * 0.85, 2),  # 15% cancellation fee
        "reason": req.reason,
        "status": "Requested",
        "created_at": now_iso(),
    }
    await db.refunds.insert_one(refund.copy())
    await db.bookings.update_one({"id": req.booking_id}, {"$set": {"status": "cancelled"}})
    safe = {k: v for k, v in refund.items() if k != "_id"}
    return safe


@api.get("/refunds/mine")
async def my_refunds(user=Depends(get_current_user)):
    items = await db.refunds.find({"user_id": user["id"]}, PROJECT_NO_ID).sort("created_at", -1).to_list(100)
    return items


@api.post("/reschedule")
async def reschedule(req: RescheduleReq, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": req.booking_id, "user_id": user["id"]}, PROJECT_NO_ID)
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    new_flight = await db.flights.find_one({"id": req.new_flight_id}, PROJECT_NO_ID)
    if not new_flight:
        raise HTTPException(status_code=404, detail="New flight not found")
    diff = max(0, new_flight["base_price"] - b["flight_snapshot"]["base_price"])
    diff = round(diff * len(b["passengers"]), 2)
    history = b.get("reschedule_history", [])
    history.append({"from_flight_id": b["flight_id"], "to_flight_id": req.new_flight_id,
                    "fare_diff": diff, "at": now_iso()})
    await db.bookings.update_one(
        {"id": req.booking_id},
        {"$set": {"flight_id": req.new_flight_id, "flight_snapshot": new_flight,
                  "reschedule_history": history, "status": "rescheduled"}},
    )
    return {"ok": True, "fare_difference": diff}


# ===== Admin =====
@api.get("/admin/dashboard")
async def admin_dash(user=Depends(require_roles("admin"))):
    total_rev = await db.payments.aggregate([{"$group": {"_id": None, "s": {"$sum": "$amount"}}}]).to_list(1)
    revenue = total_rev[0]["s"] if total_rev else 0
    bookings = await db.bookings.count_documents({})
    customers = await db.users.count_documents({"role": "customer"})
    flights = await db.flights.count_documents({})
    refunds = await db.refunds.count_documents({})
    pilots = await db.pilots.count_documents({})
    crew = await db.cabin_crew.count_documents({})
    # Last 7 days revenue
    series = []
    today = datetime.now(timezone.utc).date()
    for i in range(7, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        pipe = [{"$match": {"paid_at": {"$regex": f"^{d}"}}}, {"$group": {"_id": None, "s": {"$sum": "$amount"}}}]
        rev = await db.payments.aggregate(pipe).to_list(1)
        series.append({"date": d, "revenue": rev[0]["s"] if rev else 0})
    # Top routes
    pipe = [{"$group": {"_id": {"o": "$flight_snapshot.origin", "d": "$flight_snapshot.destination"},
                        "count": {"$sum": 1}, "revenue": {"$sum": "$fare.total"}}},
            {"$sort": {"count": -1}}, {"$limit": 5}]
    top_routes = await db.bookings.aggregate(pipe).to_list(5)
    return {
        "revenue": round(revenue, 2),
        "bookings": bookings,
        "customers": customers,
        "flights": flights,
        "refunds": refunds,
        "pilots": pilots,
        "crew": crew,
        "revenue_series": series,
        "top_routes": [{"route": f"{r['_id']['o']}-{r['_id']['d']}", "count": r["count"],
                        "revenue": round(r["revenue"], 2)} for r in top_routes],
    }


@api.get("/admin/bookings")
async def admin_bookings(user=Depends(require_roles("admin"))):
    items = await db.bookings.find({}, PROJECT_NO_ID).sort("booked_at", -1).limit(200).to_list(200)
    return items


@api.get("/admin/customers")
async def admin_customers(user=Depends(require_roles("admin"))):
    items = await db.users.find({"role": "customer"}, {"_id": 0, "password_hash": 0}).limit(500).to_list(500)
    return items


@api.get("/admin/refunds")
async def admin_refunds(user=Depends(require_roles("admin"))):
    items = await db.refunds.find({}, PROJECT_NO_ID).sort("created_at", -1).limit(200).to_list(200)
    return items


@api.post("/admin/refunds/{refund_id}/status")
async def admin_update_refund(refund_id: str, status: str = Body(..., embed=True),
                              user=Depends(require_roles("admin"))):
    await db.refunds.update_one({"id": refund_id}, {"$set": {"status": status}})
    return {"ok": True}


@api.get("/admin/email-logs")
async def admin_email_logs(user=Depends(require_roles("admin"))):
    items = await db.email_logs.find({}, PROJECT_NO_ID).sort("created_at", -1).limit(200).to_list(200)
    return items


@api.post("/admin/email-test")
async def admin_send_test_email(to: str = Body(..., embed=True), user=Depends(require_roles("admin"))):
    subj, body = email_mod.tpl_welcome("Admin Test")
    log = await email_mod.send_email(db, to, "[Test] " + subj, body, category="test")
    return log


# ===== Pilot Portal =====
@api.get("/pilot/flights")
async def pilot_flights(user=Depends(require_roles("pilot"))):
    pilot = await db.pilots.find_one({"name": user["name"]}, PROJECT_NO_ID)
    pilot_id = pilot["id"] if pilot else None
    query = {"pilot_id": pilot_id} if pilot_id else {}
    items = await db.flights.find(query, PROJECT_NO_ID).sort("departure_iso", 1).limit(50).to_list(50)
    return {"pilot": pilot, "flights": items}


# ===== Crew Portal =====
@api.get("/crew/manifest/{flight_id}")
async def crew_manifest(flight_id: str, user=Depends(require_roles("crew", "admin"))):
    flight = await db.flights.find_one({"id": flight_id}, PROJECT_NO_ID)
    if not flight:
        raise HTTPException(status_code=404, detail="Not found")
    bookings = await db.bookings.find({"flight_id": flight_id, "status": {"$in": ["confirmed", "rescheduled"]}},
                                      PROJECT_NO_ID).to_list(500)
    passengers = []
    for b in bookings:
        for i, p in enumerate(b.get("passengers", [])):
            passengers.append({
                **p,
                "pnr": b["pnr"],
                "seat": b["seats"][i] if i < len(b.get("seats", [])) else "",
                "cabin_class": b.get("cabin_class", "economy"),
                "meal": b["meals"][i] if i < len(b.get("meals", [])) else "Standard",
            })
    return {"flight": flight, "passengers": passengers, "total": len(passengers)}


@api.get("/crew/flights")
async def crew_flights(user=Depends(require_roles("crew", "admin"))):
    items = await db.flights.find({}, PROJECT_NO_ID).sort("departure_iso", 1).limit(50).to_list(50)
    return items


# ===== Mount =====
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
