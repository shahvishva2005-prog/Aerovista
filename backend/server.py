"""AeroVista Airlines - FastAPI Core Unified Production Backend Engine.
All routes are mounted dynamically under both /api and root paths to handle mixed frontend targets.
"""
import os
import io
import math
import random
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, Body
from fastapi.responses import StreamingResponse, JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from models import (
    RegisterReq, LoginReq, TokenRes, FlightSearchReq,
    CreateBookingReq, PaymentReq, RefundReq, RescheduleReq, CheckInReq, TrackReq,
    ForgotPwdReq, ResetPwdReq, ReviewReq, CareerApplicationReq,
    gen_id, now_iso,
)
from auth import hash_password, verify_password, create_token, get_current_user, require_roles
from data.airports import AIRPORTS, airport_by_iata
import emails as email_mod
import pdfs as pdf_mod

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

mongo_url = os.environ["MONGO_URL"]
# Optimized connection pooling limits to prevent Free-tier connection exhaustion
client = AsyncIOMotorClient(mongo_url, maxPoolSize=10, minPoolSize=1)
db = client[os.environ["DB_NAME"]]

# 🌟 APPLICATION INITIALIZATION 
app = FastAPI(title="AeroVista Airlines API")

# 🔒 STEP 1: MOUNT ROBUST MIDDLEWARE ENGINE (Bypasses preflight wildcard patterns)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=False,  
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🛠️ STEP 2: MANDATORY CORS ERROR BINDING EXCEPTION HANDLER
@app.exception_handler(HTTPException)
async def cors_error_protection_handler(request, exc):
    """Guarantees that security headers return to the browser even during auth failures."""
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "success": False}
    )
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# 🚀 STEP 3: EXPLICIT PREFLIGHT OPTIONS ABSORBER
@app.options("/{rest_of_path:path}")
async def dynamic_preflight_override(rest_of_path: str):
    """Intercepts browser options handshakes before dependencies can cause a crash."""
    response = JSONResponse(status_code=200, content={"status": "preflight_acknowledged"})
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# 🛠️ CORE ROUTER OBJECT
api = APIRouter()

# Background scheduler — runs pre-departure upsell scan hourly
from apscheduler.schedulers.asyncio import AsyncIOScheduler
scheduler = AsyncIOScheduler()

# ===== Helpers =====
PROJECT_NO_ID = {"_id": 0}


def _haversine_minutes(o_code: str, d_code: str) -> int:
    """Calculates exact real flight time using Great-Circle Distance metrics."""
    o_air = airport_by_iata(o_code.upper())
    d_air = airport_by_iata(d_code.upper())
    
    coords = {
        "DEL": (28.5562, 77.1000), "BOM": (19.0896, 72.8656), "BLR": (13.1986, 77.7066),
        "DXB": (25.2532, 55.3657), "JFK": (40.6413, -73.7781), "LHR": (51.4700, -0.4543),
        "SIN": (1.3644, 103.9915), "CDG": (49.0097, 2.5479), "FRA": (50.0379, 8.5622)
    }
    
    lat1, lon1 = coords.get(o_code.upper(), (28.5, 77.1)) if not o_air else (o_air.get("lat", 28.5), o_air.get("lon", 77.1))
    lat2, lon2 = coords.get(d_code.upper(), (19.0, 72.8)) if not d_air else (d_air.get("lat", 19.0), d_air.get("lon", 72.8))
    
    R = 6371.0  
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance_km = R * c
    
    flight_time_mins = int((distance_km / 800.0) * 60) + 20
    return max(45, flight_time_mins)  


def _fmt_duration(mins: int) -> str:
    return f"{mins // 60}h {mins % 60:02d}m"


def _calc_dynamic_price(base: float, departure_dt: datetime, seats_left_ratio: float) -> tuple:
    reasons = []
    price = base
    if departure_dt.weekday() in (4, 5, 6):
        price *= 1.15
        reasons.append({"label": "Weekend Demand", "factor": "+15%"})
    delta_days = (departure_dt.date() - datetime.now(timezone.utc).date()).days
    if delta_days <= 3:
        price *= 1.20
        reasons.append({"label": "Last-minute Booking", "factor": "+20%"})
    elif delta_days <= 14:
        price *= 1.08
        reasons.append({"label": "Peak Window", "factor": "+8%"})
    if departure_dt.month in (12, 3):
        price *= 1.10
        reasons.append({"label": "Festival Season", "factor": "+10%"})
    if seats_left_ratio < 0.2:
        price *= 1.25
        reasons.append({"label": "Low Seat Availability", "factor": "+25%"})
    elif delta_days <= 14 and seats_left_ratio < 0.4:
        price *= 1.10
        reasons.append({"label": "Limited Seats", "factor": "+10%"})
    if not reasons:
        reasons.append({"label": "Base Fare", "factor": "Standard"})
    return round(price, 2), reasons


# --- Dynamic Flight Generation Matrix Engine ---
def _generate_flights_for_route(origin: str, destination: str, target_date_str: str) -> List[dict]:
    """Generates exactly 4 consistent, unique flights for any route combination on a given day."""
    origin = origin.upper()
    destination = destination.upper()
    
    if origin == destination:
        return []
        
    seed_val = sum(ord(c) for c in origin + destination) + sum(ord(c) for c in target_date_str)
    random.seed(seed_val)
    
    schedules = [
        {"flight_no": "100", "dep": "06:15", "base": 4200},
        {"flight_no": "320", "dep": "11:30", "base": 5100},
        {"flight_no": "540", "dep": "16:45", "base": 6300},
        {"flight_no": "980", "dep": "21:00", "base": 4800}
    ]
    
    o_air = airport_by_iata(origin) or {"city": origin, "name": "Terminal Hub"}
    d_air = airport_by_iata(destination) or {"city": destination, "name": "Terminal Hub"}
    
    duration_mins = _haversine_minutes(origin, destination)
    
    generated = []
    for idx, sch in enumerate(schedules):
        price_variance = random.randint(-400, 1200)
        final_base = sch["base"] + price_variance
        
        dep_dt = datetime.fromisoformat(f"{target_date_str}T{sch['dep']}:00").replace(tzinfo=timezone.utc)
        arr_dt = dep_dt + timedelta(minutes=duration_mins)
        
        total_seats = random.choice([180, 186, 290, 325])
        avail_seats = total_seats - random.randint(15, total_seats // 2)

        generated.append({
            "id": f"AV-{origin}-{destination}-{target_date_str}-{sch['flight_no']}",
            "flight_number": f"AV{100 + idx * 25 + (seed_val % 40):03d}",
            "origin": origin, 
            "origin_city": o_air.get("city", origin),
            "destination": destination, 
            "destination_city": d_air.get("city", destination),
            "departure_date": target_date_str,
            "departure_time": sch["dep"],
            "arrival_date": arr_dt.date().isoformat(),
            "arrival_time": arr_dt.strftime("%H:%M"),
            "departure_iso": dep_dt.isoformat(),
            "arrival_iso": arr_dt.isoformat(),
            "duration_mins": duration_mins,
            "duration": _fmt_duration(duration_mins),
            "stops": 0,
            "layover": None,
            "aircraft": "Airbus A320neo" if total_seats < 200 else "Boeing 787 Dreamliner",
            "aircraft_id": f"AC-{seed_val % 100:02d}",
            "terminal": random.choice(["T1", "T2", "T3"]),
            "gate": random.choice(["A12", "B07", "C22", "D15"]),
            "boarding_time": (dep_dt - timedelta(minutes=40)).strftime("%H:%M"),
            "base_price": max(3200, final_base),
            "total_seats": total_seats,
            "available_seats": avail_seats,
            "status": "scheduled"
        })
        
    return generated


# ===== Seed Endpoint =====
@api.get("/admin/seed")
async def admin_seed(force: bool = False):
    existing = await db.users.count_documents({})
    if existing > 0 and not force:
        return {"message": "Already seeded", "users": existing}

    if force:
        await db.users.delete_many({"email": {"$in": ["admin@aerovista.com", "pilot@aerovista.com", "crew@aerovista.com", "customer@aerovista.com"]}})
        for coll in ["bookings", "payments", "refunds", "email_logs", "notifications", "financial_records", "reviews", "career_applications", "traffic_events"]:
            await db[coll].delete_many({})

    now = datetime.now(timezone.utc)

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

    fin_records = [
        ("2025-09", "Route P&L", "DEL-BOM", 1850000, 42000, 18.5, "Off"),
        ("2025-09", "Route P&L", "DEL-BLR", 1620000, 31000, 16.2, "Off"),
        ("2025-09", "Route P&L", "BOM-DXB", 4250000, 88000, 22.8, "Off"),
        ("2025-10", "Route P&L", "DEL-BOM", 2110000, 51000, 19.4, "Mid"),
        ("2025-10", "Route P&L", "DEL-JFK", 6700000, 121000, 24.5, "Mid"),
        ("2025-10", "Route P&L", "BOM-SIN", 3920000, 74000, 21.6, "Mid"),
        ("2025-11", "Route P&L", "DEL-LHR", 7850000, 145000, 26.1, "Peak"),
        ("2025-11", "Route P&L", "DEL-BOM", 2950000, 68000, 22.2, "Peak"),
        ("2025-11", "Route P&L", "BLR-SIN", 4480000, 92000, 23.0, "Peak"),
        ("2025-12", "Route P&L", "DEL-DXB", 5210000, 110000, 25.4, "Peak"),
        ("2025-12", "Route P&L", "DEL-CDG", 7120000, 138000, 25.9, "Peak"),
        ("2025-12", "Route P&L", "BOM-FRA", 6650000, 128000, 24.8, "Peak"),
        ("2026-01", "Route P&L", "DEL-BOM", 2240000, 52000, 19.8, "Mid"),
        ("2026-01", "Route P&L", "DEL-HKG", 5380000, 96000, 23.4, "Mid"),
        ("2026-01", "Route P&L", "BOM-DOH", 4810000, 88000, 22.7, "Mid"),
        ("2026-02", "Route P&L", "DEL-BKK", 3950000, 74000, 21.2, "Mid"),
        ("2026-02", "Route P&L", "BLR-BOM", 1480000, 32000, 17.5, "Mid"),
        ("2026-02", "Route P&L", "MAA-BOM", 1280000, 28000, 16.8, "Mid"),
        ("2026-02", "Refund Summary", "ALL", 0, 1342000, 0, "Mid"),
        ("2026-02", "Operating Cost", "FUEL", 0, 0, 0, "Mid"),
    ]
    fin_docs = [{
        "id": gen_id(), "month": m, "kind": k, "route": r, "revenue_inr": rev, "refunds_inr": refs,
        "net_inr": rev - refs, "profit_margin_pct": pm, "season": s, "created_at": now.isoformat()
    } for m, k, r, rev, refs, pm, s in fin_records]
    await db.financial_records.insert_many(fin_docs)

    today = now.date()
    traffic_docs = []
    for d in range(0, 30):
        day = today - timedelta(days=29 - d)
        base = random.randint(1200, 1800)
        if day.weekday() in (4, 5, 6): base = int(base * 1.4)
        traffic_docs.append({
            "id": gen_id(), "date": day.isoformat(), "page_views": base,
            "unique_visitors": int(base * random.uniform(0.55, 0.72)),
            "sessions": int(base * random.uniform(0.7, 0.85)), "bounce_rate": round(random.uniform(28, 45), 1),
        })
    await db.traffic_events.insert_many(traffic_docs)

    return {"message": "Seeded", "users": 4, "financial_records": len(fin_docs), "traffic_events": len(traffic_docs)}


# ===== Public Operations =====
@api.get("/")
async def root():
    return {"app": "AeroVista Airlines API", "status": "ok", "airports_count": len(AIRPORTS)}


@api.get("/airports")
async def list_airports(q: Optional[str] = None):
    if not q:
        return AIRPORTS
    qq = q.lower().strip()
    return [a for a in AIRPORTS if qq in a["iata"].lower() or qq in a["city"].lower() or qq in a["country"].lower()][:50]


@api.get("/stats")
async def public_stats():
    return {
        "passengers": "2.5M+", "flights_completed": "185,000+", "aircraft": "85+", "pilots": "320+",
        "cabin_crew": "780+", "countries": "45+", "destinations": f"{len(AIRPORTS)}+", "satisfaction": "98.7%",
    }


# ===== Auth Routes =====
@api.post("/auth/register", response_model=TokenRes)
async def register(req: RegisterReq):
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": gen_id(), "name": req.name, "email": req.email.lower(), "password_hash": hash_password(req.password),
        "role": "customer", "mobile": req.mobile or "", "created_at": now_iso(), "loyalty_tier": "Bronze", "loyalty_points": 0,
    }
    await db.users.insert_one(user)
    token = create_token({"sub": user["id"], "role": "customer"})
    safe = {k: v for k, v in user.items() if k not in ("password_hash", "_id")}
    subj, body = email_mod.tpl_welcome(req.name)
    await email_mod.send_email(db, req.email, subj, body, category="welcome")
    return TokenRes(access_token=token, user=safe)


@api.post("/auth/login", response_model=TokenRes)
async def login(req: LoginReq):
    identifier = (req.email or req.mobile or "").strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="Provide email or mobile number")
    user = None
    if "@" in identifier:
        user = await db.users.find_one({"email": identifier.lower()})
    else:
        digits = "".join(ch for ch in identifier if ch.isdigit())
        if len(digits) < 7: raise HTTPException(status_code=400, detail="Invalid mobile number")
        user = await db.users.find_one({"mobile": identifier})
        if not user:
            tail = digits[-10:]
            user = await db.users.find_one({"mobile": {"$regex": f"{tail}$"}})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token({"sub": user["id"], "role": user["role"]})
    safe = {k: v for k, v in user.items() if k not in ("password_hash", "_id")}
    return TokenRes(access_token=token, user=safe)


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# ===== Flights Search Operations =====
@api.post("/flights/search")
async def search_flights(req: FlightSearchReq):
    flights = _generate_flights_for_route(req.origin, req.destination, req.departure_date)
    
    # 🔒 8-Hour Real-Time Guard Clamping Matrix
    now = datetime.now(timezone.utc)
    booking_cutoff = now + timedelta(hours=8)
    
    enriched = []
    for f in flights:
        dep_iso_str = f["departure_iso"].replace("Z", "+00:00")
        dep_dt = datetime.fromisoformat(dep_iso_str).replace(tzinfo=timezone.utc)
        
        if dep_dt < booking_cutoff:
            continue
            
        ratio = f["available_seats"] / f["total_seats"]
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
    parts = flight_id.split("-")
    if len(parts) >= 5 and parts[0] == "AV":
        org, dst, target_date_str = parts[1], parts[2], parts[3]
        route_pool = _generate_flights_for_route(org, dst, target_date_str)
        f = next((item for item in route_pool if item["id"] == flight_id), None)
        if not f:
            f = route_pool[0]
            f["id"] = flight_id
    else:
        org, dst = "DEL", "BOM"
        today_str = datetime.now(timezone.utc).date().isoformat()
        route_pool = _generate_flights_for_route(org, dst, today_str)
        f = route_pool[0]
        f["id"] = flight_id

    rows, cols = 30, ["A", "B", "C", "D", "E", "F"]
    seed_hash = sum(ord(c) for c in flight_id)
    random.seed(seed_hash)
    
    occupied = set(random.sample([f"{r}{c}" for r in range(1, rows + 1) for c in cols], k=45))
    seat_map = []
    for r in range(1, rows + 1):
        for c in cols:
            seat = f"{r}{c}"
            seat_type = "first" if r <= 2 else "business" if r <= 5 else "premium_economy" if r <= 8 else "economy"
            state = "occupied" if seat in occupied else "available"
            extra_price = {"first": 9500, "business": 4500, "premium_economy": 800, "economy": 200 if c in ("A", "F") else 0}[seat_type]
            seat_map.append({"seat": seat, "row": r, "col": c, "type": seat_type, "state": state, "extra_price": extra_price})
    f["seat_map"] = seat_map
    return f


# ===== Bookings =====
@api.post("/bookings")
async def create_booking(req: CreateBookingReq, user=Depends(get_current_user)):
    parts = req.flight_id.split("-")
    if len(parts) >= 5 and parts[0] == "AV":
         org, dst, target_date_str = parts[1], parts[2], parts[3]
         pool = _generate_flights_for_route(org, dst, target_date_str)
         flight = next((item for item in pool if item["id"] == req.flight_id), pool[0])
    else:
         raise HTTPException(status_code=404, detail="Flight identifier invalid or missing date context")

    dep_iso_str = flight["departure_iso"].replace("Z", "+00:00")
    dep_dt = datetime.fromisoformat(dep_iso_str).replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    
    if dep_dt <= (now + timedelta(hours=8)): 
        raise HTTPException(status_code=400, detail="Booking window locked. Flights must be booked at least 8 hours before departure.")

    ratio = flight["available_seats"] / flight["total_seats"]
    mult = {"economy": 1.0, "premium_economy": 1.6, "business": 2.8, "first": 4.5}.get(req.cabin_class, 1.0)
    base_per_pax, _ = _calc_dynamic_price(flight["base_price"] * mult, dep_dt, ratio)
    n_pax = len(req.passengers)
    base = round(base_per_pax * n_pax, 2)

    concession_pax = sum(1 for p in req.passengers if p.is_medical or p.is_armed_forces)
    concession = round(base_per_pax * 0.20 * concession_pax, 2)
    addons = (800 * n_pax if req.add_baggage else 0) + (250 * n_pax if req.add_insurance else 0) + (350 * len([m for m in req.meal_preferences if m and m != "standard"]))

    discount = concession
    promo = (req.promo_code or "").upper().strip()
    if promo == "HDFC10": discount += round(base * 0.10, 2)
    elif promo == "SBI500": discount += 500

    corporate_block = (req.billing.model_dump().get("corporate") or {}) if req.billing else {}
    if corporate_block and corporate_block.get("company_name"): discount += round(base * 0.05, 2)

    tax_rate = 0.05 if req.cabin_class == "economy" else 0.12
    taxes = round((base + addons - discount) * tax_rate, 2)
    convenience = 50
    total = round(base + addons - discount + taxes + convenience, 2)

    booking = {
        "id": gen_id(), "user_id": user["id"], "user_email": user["email"], "flight_id": flight["id"], "flight_snapshot": flight,
        "cabin_class": req.cabin_class, "passengers": [p.model_dump() for p in req.passengers], "seats": req.seat_numbers or [],
        "meals": req.meal_preferences or [], "add_baggage": req.add_baggage, "add_insurance": req.add_insurance, "billing": req.billing.model_dump(),
        "pnr": _gen_codes("AV", 6), "ticket_number": _gen_codes("TKT", 9), "invoice_number": _gen_codes("INV", 8),
        "receipt_number": _gen_codes("RCP", 8), "boarding_pass_number": _gen_codes("BP", 7),
        "fare": {"base": base, "base_per_pax": base_per_pax, "addons": addons, "discount": discount, "concession": concession, "taxes": taxes, "convenience": convenience, "total": total},
        "status": "pending_payment", "payment_status": "pending", "checked_in": False, "booked_at": now_iso(),
    }
    await db.bookings.insert_one(booking.copy())
    return {k: v for k, v in booking.items() if k != "_id"}


@api.post("/bookings/{booking_id}/pay")
async def pay_booking(booking_id: str, req: PaymentReq, user=Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": booking_id, "user_id": user["id"]}, PROJECT_NO_ID)
    if not booking: raise HTTPException(status_code=404, detail="Booking not found")
    if booking["payment_status"] == "paid": raise HTTPException(status_code=400, detail="Already paid")
    
    amount = booking["fare"]["total"]
    payment = {
        "id": gen_id(), "booking_id": booking_id, "user_id": user["id"], "transaction_id": _gen_codes("TXN", 10),
        "method": req.method, "amount": amount, "currency": "INR", "status": "success", "bank": req.bank,
        "card_last4": req.card_number_last4, "upi_id": req.upi_id, "paid_at": now_iso(),
    }
    await db.payments.insert_one(payment.copy())
    await db.bookings.update_one({"id": booking_id}, {"$set": {"payment_status": "paid", "status": "confirmed", "paid_at": payment["paid_at"]}})
    
    points = int(amount // 100)
    await db.users.update_one({"id": user["id"]}, {"$inc": {"loyalty_points": points}})

    booking_after = await db.bookings.find_one({"id": booking_id}, PROJECT_NO_ID)
    flight = booking_after["flight_snapshot"]
    
    pdfs_attached = []
    try:
        pdfs_attached = [
            (f"eticket-{booking_after['pnr']}.pdf", pdf_mod.generate_ticket_pdf(booking_after, flight, booking_after["passengers"])),
            (f"invoice-{booking_after['invoice_number']}.pdf", pdf_mod.generate_invoice_pdf(booking_after, flight, booking_after["passengers"])),
            (f"receipt-{booking_after['receipt_number']}.pdf", pdf_mod.generate_receipt_pdf(payment, booking_after)),
        ]
    except Exception as e: logger.warning(f"PDF compilation failure skipped: {e}")
        
    subj, body = email_mod.tpl_booking_confirmation(booking_after["pnr"], f"{flight['origin']} → {flight['destination']}", flight["departure_date"], user["name"])
    await email_mod.send_email(db, user["email"], subj, body, attachments=pdfs_attached, category="booking_confirmation")
    return {"payment": {k: v for k, v in payment.items() if k != "_id"}, "booking_id": booking_id, "pnr": booking_after["pnr"], "points_earned": points}


@api.get("/bookings/mine")
async def my_bookings(user=Depends(get_current_user)):
    return await db.bookings.find({"user_id": user["id"]}, PROJECT_NO_ID).sort("booked_at", -1).to_list(200)


@api.get("/bookings/{booking_id}")
async def booking_detail(booking_id: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, PROJECT_NO_ID)
    if not b: raise HTTPException(status_code=404, detail="Not found")
    if b["user_id"] != user["id"] and user.get("role") != "admin": raise HTTPException(status_code=403, detail="Forbidden")
    return b


# ===== Document Render Streams =====
@api.get("/bookings/{booking_id}/ticket.pdf")
async def download_ticket(booking_id: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, PROJECT_NO_ID)
    if not b or (b["user_id"] != user["id"] and b.get("role") != "admin"): raise HTTPException(status_code=404, detail="Not found")
    return StreamingResponse(io.BytesIO(pdf_mod.generate_ticket_pdf(b, b["flight_snapshot"], b["passengers"])), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=eticket-{b['pnr']}.pdf"})


@api.get("/bookings/{booking_id}/invoice.pdf")
async def download_invoice(booking_id: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, PROJECT_NO_ID)
    if not b or (b["user_id"] != user["id"] and b.get("role") != "admin"): raise HTTPException(status_code=404, detail="Not found")
    return StreamingResponse(io.BytesIO(pdf_mod.generate_invoice_pdf(b, b["flight_snapshot"], b["passengers"])), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=invoice-{b['invoice_number']}.pdf"})


@api.get("/bookings/{booking_id}/receipt.pdf")
async def download_receipt(booking_id: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, PROJECT_NO_ID)
    if not b or (b["user_id"] != user["id"] and b.get("role") != "admin"): raise HTTPException(status_code=404, detail="Not found")
    p = await db.payments.find_one({"booking_id": booking_id}, PROJECT_NO_ID) or {}
    return StreamingResponse(io.BytesIO(pdf_mod.generate_receipt_pdf(p, b)), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=receipt-{b['receipt_number']}.pdf"})


@api.get("/bookings/{booking_id}/boarding-pass.pdf")
async def download_boarding(booking_id: str, passenger_idx: int = 0, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id}, PROJECT_NO_ID)
    if not b or (b["user_id"] != user["id"] and b.get("role") != "admin"): raise HTTPException(status_code=404, detail="Not found")
    if passenger_idx >= len(b["passengers"]): raise HTTPException(status_code=400, detail="Invalid passenger index")
    seat = b["seats"][passenger_idx] if passenger_idx < len(b["seats"]) else "TBA"
    return StreamingResponse(io.BytesIO(pdf_mod.generate_boarding_pass_pdf(b, b["flight_snapshot"], b["passengers"][passenger_idx], seat)), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=boarding-{b['pnr']}-{passenger_idx+1}.pdf"})


# ===== Track & Check-In =====
@api.post("/track")
async def track(req: TrackReq):
    query = {}
    if req.pnr: query["pnr"] = req.pnr.upper()
    if req.email: query["user_email"] = req.email.lower()
    if req.mobile: query["billing.contact_mobile"] = req.mobile
    if not query: raise HTTPException(status_code=400, detail="Provide PNR, email, or mobile")
    return await db.bookings.find(query, PROJECT_NO_ID).to_list(20)


@api.post("/checkin")
async def checkin(req: CheckInReq):
    b = await db.bookings.find_one({"pnr": req.pnr.upper()}, PROJECT_NO_ID)
    if not b: raise HTTPException(status_code=404, detail="PNR not found")
    if not any(p["last_name"].lower() == req.last_name.lower() for p in b["passengers"]): raise HTTPException(status_code=400, detail="Last name mismatch")
    dep_dt = datetime.fromisoformat(b["flight_snapshot"]["departure_iso"].replace("Z", "+00:00")).replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    if dep_dt - now > timedelta(hours=24): raise HTTPException(status_code=400, detail="Web check-in opens 24 hours before departure")
    if dep_dt - now < timedelta(minutes=60): raise HTTPException(status_code=400, detail="Web check-in closes 60 minutes before departure")
    await db.bookings.update_one({"id": b["id"]}, {"$set": {"checked_in": True, "checkin_at": now_iso()}})
    return {"ok": True, "booking_id": b["id"], "pnr": b["pnr"], "passengers": b["passengers"], "seats": b["seats"]}


# ===== Cancellation Management =====
@api.post("/refunds")
async def request_refund(req: RefundReq, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": req.booking_id, "user_id": user["id"]}, PROJECT_NO_ID)
    if not b: raise HTTPException(status_code=404, detail="Not found")
    if b["payment_status"] != "paid": raise HTTPException(status_code=400, detail="Booking is not paid")
    cnt = await db.refunds.count_documents({})
    refund = {
        "id": gen_id(), "refund_id": f"RFD{cnt + 1:06d}", "booking_id": req.booking_id, "pnr": b["pnr"],
        "user_id": user["id"], "amount": round(b["fare"]["total"] * 0.85, 2), "reason": req.reason, "status": "Requested", "created_at": now_iso(),
    }
    await db.refunds.insert_one(refund.copy())
    await db.bookings.update_one({"id": req.booking_id}, {"$set": {"status": "cancelled"}})
    return {k: v for k, v in refund.items() if k != "_id"}


@api.get("/refunds/mine")
async def my_refunds(user=Depends(get_current_user)):
    return await db.refunds.find({"user_id": user["id"]}, PROJECT_NO_ID).sort("created_at", -1).to_list(100)


@api.post("/reschedule")
async def reschedule(req: RescheduleReq, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": req.booking_id, "user_id": user["id"]}, PROJECT_NO_ID)
    if not b: raise HTTPException(status_code=404, detail="Not found")
    parts = req.new_flight_id.split("-")
    org, dst, target_date_str = parts[1], parts[2], parts[3]
    new_flight = _generate_flights_for_route(org, dst, target_date_str)[0]
    new_flight["id"] = req.new_flight_id
    diff = round(max(0, new_flight["base_price"] - b["flight_snapshot"]["base_price"]) * len(b["passengers"]), 2)
    history = b.get("reschedule_history", [])
    history.append({"from_flight_id": b["flight_id"], "to_flight_id": req.new_flight_id, "fare_diff": diff, "at": now_iso()})
    await db.bookings.update_one({"id": req.booking_id}, {"$set": {"flight_id": req.new_flight_id, "flight_snapshot": new_flight, "reschedule_history": history, "status": "rescheduled"}})
    return {"ok": True, "fare_difference": diff}


# ===== Pilot Portal =====
@api.get("/pilot/flights")
async def pilot_flights(user=Depends(require_roles("pilot"))):
    pilot = await db.pilots.find_one({"name": user["name"]}, PROJECT_NO_ID)
    if not pilot: pilot = await db.pilots.find_one({}, PROJECT_NO_ID, sort=[("employee_id", 1)])
    pilot_id = pilot["id"] if pilot else None
    query = {"pilot_id": pilot_id} if pilot_id else {}
    items = await db.flights.find(query, PROJECT_NO_ID).sort("departure_iso", 1).limit(50).to_list(50)
    crew_ids = []
    for f in items: crew_ids += f.get("crew_ids", [])
    crew_by_id = {}
    if crew_ids:
        crew_docs = await db.cabin_crew.find({"id": {"$in": list(set(crew_ids))}}, PROJECT_NO_ID).to_list(200)
        crew_by_id = {c["id"]: c for c in crew_docs}
    for f in items: f["crew"] = [crew_by_id.get(cid) for cid in f.get("crew_ids", []) if crew_by_id.get(cid)]
    roster = await db.cabin_crew.find({}, PROJECT_NO_ID).sort("employee_id", 1).to_list(200)
    return {"pilot": pilot, "flights": items, "cabin_crew_roster": roster}


# ===== Crew Portal =====
@api.get("/crew/manifest/{flight_id}")
async def crew_manifest(flight_id: str, user=Depends(require_roles("crew", "admin"))):
    flight = await db.flights.find_one({"id": flight_id}, PROJECT_NO_ID)
    if not flight: raise HTTPException(status_code=404, detail="Not found")
    bookings = await db.bookings.find({"flight_id": flight_id, "status": {"$in": ["confirmed", "rescheduled"]}}, PROJECT_NO_ID).to_list(500)
    passengers = []
    for b in bookings:
        for i, p in enumerate(b.get("passengers", [])):
            passengers.append({**p, "pnr": b["pnr"], "seat": b["seats"][i] if i < len(b.get("seats", [])) else "", "cabin_class": b.get("cabin_class", "economy"), "meal": b["meals"][i] if i < len(b.get("meals", [])) else "Standard"})
    return {"flight": flight, "passengers": passengers, "total": len(passengers)}


@api.get("/crew/flights")
async def crew_flights(user=Depends(require_roles("crew", "admin"))):
    return await db.flights.find({}, PROJECT_NO_ID).sort("departure_iso", 1).limit(50).to_list(50)


# ===== Traffic Log Metric Hub =====
@api.post("/track/event")
async def track_event(payload: dict = Body(...)):
    today_str = datetime.now(timezone.utc).date().isoformat()
    await db.traffic_events.update_one(
        {"date": today_str, "live": True},
        {"$inc": {"page_views": 1}, "$setOnInsert": {"id": gen_id(), "date": today_str, "live": True, "unique_visitors": 1, "sessions": 1, "bounce_rate": 0}},
        upsert=True
    )
    return {"ok": True}


# ===== Analytical Charts =====
@api.get("/admin/dashboard")
async def admin_dash(user=Depends(require_roles("admin"))):
    total_rev = await db.payments.aggregate([{"$group": {"_id": None, "s": {"$sum": "$amount"}}}]).to_list(1)
    revenue = total_rev[0]["s"] if total_rev else 0
    series = []
    today = datetime.now(timezone.utc).date()
    for i in range(7, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        rev = await db.payments.aggregate([{"$match": {"paid_at": {"$regex": f"^{d}"}}}, {"$group": {"_id": None, "s": {"$sum": "$amount"}}}]).to_list(1)
        series.append({"date": d, "revenue": rev[0]["s"] if rev else 0})
    top_routes = await db.bookings.aggregate([
        {"$group": {"_id": {"o": "$flight_snapshot.origin", "d": "$flight_snapshot.destination"}, "count": {"$sum": 1}, "revenue": {"$sum": "$fare.total"}}},
        {"$sort": {"count": -1}}, {"$limit": 5}
    ]).to_list(5)
    return {
        "revenue": round(revenue, 2), "bookings": await db.bookings.count_documents({}), "customers": await db.users.count_documents({"role": "customer"}),
        "flights": 480, "refunds": await db.refunds.count_documents({}), "pilots": 320, "crew": 780, "revenue_series": series,
        "top_routes": [{"route": f"{r['_id']['o']}-{r['_id']['d']}", "count": r["count"], "revenue": round(r["revenue"], 2)} for r in top_routes],
    }


@api.get("/admin/charts/bookings-trend")
async def admin_bookings_trend(days: int = 30, user=Depends(require_roles("admin"))):
    today = datetime.now(timezone.utc).date()
    series = []
    for i in range(days, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        series.append({"date": d, "bookings": await db.bookings.count_documents({"booked_at": {"$regex": f"^{d}"}})})
    return series


@api.get("/admin/charts/occupancy")
async def admin_occupancy(user=Depends(require_roles("admin"))):
    cls_agg = await db.bookings.aggregate([{"$group": {"_id": "$cabin_class", "count": {"$sum": 1}, "revenue": {"$sum": "$fare.total"}}}]).to_list(10)
    ref_agg = await db.refunds.aggregate([{"$group": {"_id": "$status", "count": {"$sum": 1}}}]).to_list(10)
    return {
        "occupancy_pct": 74.8, 
        "cabin_split": [{"class": c["_id"] or "economy", "count": c["count"], "revenue": round(c["revenue"] or 0, 2)} for c in cls_agg],
        "refund_split": [{"status": r["_id"], "count": r["count"]} for r in ref_agg]
    }


@api.get("/admin/charts/traffic")
async def admin_charts_traffic(days: int = 30, user=Depends(require_roles("admin"))):
    today = datetime.now(timezone.utc).date()
    start_iso = (today - timedelta(days=days)).isoformat()
    rows = await db.traffic_events.aggregate([{"$match": {"date": {"$gte": start_iso}}},{"$group": {"_id": "$date", "page_views": {"$sum": "$page_views"}, "unique_visitors": {"$sum": "$unique_visitors"}, "sessions": {"$sum": "$sessions"}}},{"$sort": {"_id": 1}}]).to_list(500)
    return [{"date": r["_id"], "page_views": r["page_views"], "unique_visitors": r["unique_visitors"], "sessions": r["sessions"]} for r in rows]


@api.get("/admin/charts/user-growth")
async def admin_charts_user_growth(days: int = 30, user=Depends(require_roles("admin"))):
    today = datetime.now(timezone.utc).date()
    rows = await db.users.aggregate([{"$match": {"role": "customer"}}, {"$project": {"day": {"$substr": ["$created_at", 0, 10]}}}, {"$group": {"_id": "$day", "count": {"$sum": 1}}}, {"$sort": {"_id": 1}}]).to_list(500)
    by_day = {r["_id"]: r["count"] for r in rows}
    series, cumulative = [], 0
    for r in rows:
        if r["_id"] < (today - timedelta(days=days)).isoformat(): cumulative += r["count"]
    for i in range(days, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        cumulative += by_day.get(d, 0)
        series.append({"date": d, "users": cumulative, "new": by_day.get(d, 0)})
    return series


@api.get("/admin/charts/seasons")
async def admin_charts_seasons(user=Depends(require_roles("admin"))):
    rows = await db.financial_records.aggregate([{"$group": {"_id": "$season", "revenue": {"$sum": "$revenue_inr"}, "refunds": {"$sum": "$refunds_inr"}, "records": {"$sum": 1}}}]).to_list(10)
    return [{"season": r["_id"] or "Off", "revenue": r["revenue"], "refunds": r["refunds"], "records": r["records"]} for r in rows]


@api.get("/admin/charts/festivals")
async def admin_charts_festivals(user=Depends(require_roles("admin"))):
    festivals = [("Diwali Travel", ["2025-10", "2025-11"], "diya"), ("Christmas & New Year", ["2025-12", "2026-01"], "tree"), ("Holi Getaway", ["2026-03"], "colors"), ("Summer Family", ["2026-05", "2026-06"], "sun"), ("Eid Travel", ["2026-04"], "moon")]
    out = []
    for f in festivals:
        agg = await db.financial_records.aggregate([{"$match": {"month": {"$in": f[1]}}}, {"$group": {"_id": None, "rev": {"$sum": "$revenue_inr"}}}]).to_list(1)
        out.append({"name": f[0], "revenue": agg[0]["rev"] if agg else 0, "months": f[1], "icon": f[2]})
    return out


# ===== Admin Management Endpoints =====
@api.get("/admin/bookings")
async def admin_bookings(user=Depends(require_roles("admin"))):
    return await db.bookings.find({}, PROJECT_NO_ID).sort("booked_at", -1).limit(200).to_list(200)


@api.get("/admin/customers")
async def admin_customers(user=Depends(require_roles("admin"))):
    return await db.users.find({"role": "customer"}, {"_id": 0, "password_hash": 0}).limit(500).to_list(500)


@api.get("/admin/refunds")
async def admin_refunds(user=Depends(require_roles("admin"))):
    return await db.refunds.find({}, PROJECT_NO_ID).sort("created_at", -1).limit(200).to_list(200)


@api.post("/admin/refunds/{refund_id}/status")
async def admin_update_refund(refund_id: str, status: str = Body(..., embed=True), user=Depends(require_roles("admin"))):
    await db.refunds.update_one({"id": refund_id}, {"$set": {"status": status}})
    return {"ok": True}


@api.get("/admin/financial-records")
async def admin_financial_records(user=Depends(require_roles("admin"))):
    return await db.financial_records.find({}, PROJECT_NO_ID).sort("month", 1).limit(500).to_list(500)


@api.post("/admin/financial-records/import")
async def admin_financial_import(payload: dict = Body(...), user=Depends(require_roles("admin"))):
    rows = payload.get("rows", [])
    if not isinstance(rows, list): raise HTTPException(status_code=400, detail="rows must be a list")
    inserted, updated = 0, 0
    for r in rows:
        try:
            month = str(r.get("Month") or r.get("month") or "").strip()
            kind = str(r.get("Kind") or r.get("kind") or "Route P&L").strip()
            route = str(r.get("Route") or r.get("route") or "ALL").strip()
            rev = float(r.get("Revenue (INR)") or r.get("revenue_inr") or 0)
            refs = float(r.get("Refunds (INR)") or r.get("refunds_inr") or 0)
            pm = float(r.get("Profit Margin %") or r.get("profit_margin_pct") or 0)
            season = str(r.get("Season") or r.get("season") or "Off").strip()
            if not month: continue
            doc = {"month": month, "kind": kind, "route": route, "revenue_inr": rev, "refunds_inr": refs, "net_inr": rev - refs, "profit_margin_pct": pm, "season": season, "imported_at": now_iso()}
            res = await db.financial_records.update_one({"month": month, "kind": kind, "route": route}, {"$set": doc, "$setOnInsert": {"id": gen_id(), "created_at": now_iso()}}, upsert=True)
            if res.upserted_id: inserted += 1
            elif res.modified_count: updated += 1
        except Exception as e: logger.warning(f"Skipped ledger row: {e}")
    return {"ok": True, "inserted": inserted, "updated": updated, "total": len(rows)}


@api.get("/admin/reviews")
async def admin_reviews(user=Depends(require_roles("admin"))):
    return await db.reviews.find({}, PROJECT_NO_ID).sort("created_at", -1).limit(500).to_list(500)


@api.get("/admin/email-logs")
async def admin_email_logs(user=Depends(require_roles("admin"))):
    return await db.email_logs.find({}, PROJECT_NO_ID).sort("created_at", -1).limit(200).to_list(200)


@api.post("/admin/email-test")
async def admin_send_test_email(to: str = Body(..., embed=True), user=Depends(require_roles("admin"))):
    subj, body = email_mod.tpl_welcome("Admin Test")
    log = await email_mod.send_email(db, to, "[Test] " + subj, body, category="test")
    return log


# ===== Spreadsheet Matrix Exporters =====

def _df_from_records(records, columns):
    import pandas as pd
    return pd.DataFrame(records, columns=columns)


def _stream_csv(df, filename: str):
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return StreamingResponse(io.BytesIO(buf.getvalue().encode("utf-8")), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}.csv"})


def _stream_xlsx(df, filename: str, sheet: str = "Sheet1"):
    bio = io.BytesIO()
    with __import__("pandas").ExcelWriter(bio, engine="openpyxl") as w:
        df.to_excel(w, index=False, sheet_name=sheet)
    bio.seek(0)
    return StreamingResponse(bio, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={filename}.xlsx"})


async def _export_bookings_rows():
    items = await db.bookings.find({}, PROJECT_NO_ID).sort("booked_at", -1).limit(5000).to_list(5000)
    rows = []
    for b in items:
        f = b.get("flight_snapshot", {})
        rows.append({
            "PNR": b.get("pnr"), "Ticket Number": b.get("ticket_number"), "Customer Email": b.get("user_email"),
            "Flight": f.get("flight_number"), "Origin": f.get("origin"), "Destination": f.get("destination"),
            "Departure Date": f.get("departure_date"), "Departure Time": f.get("departure_time"), "Cabin Class": b.get("cabin_class"),
            "Passenger Count": len(b.get("passengers", [])), "Status": b.get("status"), "Payment Status": b.get("payment_status"),
            "Total Paid (INR)": b.get("fare", {}).get("total", 0), "Booked At Date": b.get("booked_at"),
        })
    return rows


async def _export_payments_rows():
    items = await db.payments.find({}, PROJECT_NO_ID).sort("paid_at", -1).limit(5000).to_list(5000)
    return [{
        "Transaction ID": p.get("transaction_id"), "Booking ID": p.get("booking_id"),
        "Payment Method": p.get("method"), "Amount Paid": p.get("amount"), "Currency": p.get("currency"),
        "Status": p.get("status"), "Bank Processing Node": p.get("bank"), "Paid At Timestamp": p.get("paid_at")
    } for p in items]


async def _export_customers_rows():
    items = await db.users.find({"role": "customer"}, {"_id": 0, "password_hash": 0}).limit(5000).to_list(5000)
    return [{
        "Customer Name": c.get("name"), "Email Address": c.get("email"), "Mobile Contact": c.get("mobile"),
        "Loyalty Tier Matrix": c.get("loyalty_tier"), "Accumulated Points": c.get("loyalty_points", 0), "Joined At": c.get("created_at")
    } for c in items]


async def _export_refunds_rows():
    items = await db.refunds.find({}, PROJECT_NO_ID).sort("created_at", -1).limit(5000).to_list(5000)
    return [{
        "Refund ID": r.get("refund_id"), "PNR Link": r.get("pnr"), "Disbursed Amount": r.get("amount"),
        "Reasoning Profile": r.get("reason"), "Status": r.get("status"), "Created At Timestamp": r.get("created_at")
    } for r in items]


async def _export_flights_rows():
    items = await db.flights.find({}, PROJECT_NO_ID).sort("departure_iso", 1).limit(2000).to_list(2000)
    return [{
        "Flight Number": f.get("flight_number"), "Origin": f.get("origin"), "Destination": f.get("destination"),
        "Date": f.get("departure_date"), "Departure Window": f.get("departure_time"), "Arrival Window": f.get("arrival_time"),
        "Aircraft Fleet Type": f.get("aircraft"), "Total Seats": f.get("total_seats"), "Available Open Seats": f.get("available_seats"),
        "Base Price Standard": f.get("base_price"), "Status": f.get("status")
    } for f in items]


async def _export_financials_rows():
    items = await db.financial_records.find({}, PROJECT_NO_ID).sort("month", 1).limit(5000).to_list(5000)
    return [{
        "Accounting Month": r.get("month"), "Ledger Kind": r.get("kind"), "Target Route Code": r.get("route"),
        "Gross Revenue (INR)": r.get("revenue_inr"), "Total Deducted Refunds (INR)": r.get("refunds_inr"),
        "Net Operating Revenue": r.get("net_inr"), "Profit Margin Percentage": r.get("profit_margin_pct"), "Seasonal Category": r.get("season"),
    } for r in items]

EXPORT_MAP = {
    "bookings": _export_bookings_rows, "payments": _export_payments_rows, "customers": _export_customers_rows,
    "refunds": _export_refunds_rows, "flights": _export_flights_rows, "financials": _export_financials_rows,
}


@api.get("/admin/exports/{kind}.{fmt}")
async def admin_export(kind: str, fmt: str, user=Depends(require_roles("admin"))):
    if kind not in EXPORT_MAP: raise HTTPException(status_code=400, detail="Unknown export kind requested")
    if fmt not in ("csv", "xlsx"): raise HTTPException(status_code=400, detail="Format must be csv or xlsx")
    rows_fn = EXPORT_MAP[kind]
    rows = await rows_fn()
    if not rows: rows = [{"System Notice": f"No records inside database targets for table {kind}."}]
    df = _df_from_records(rows, list(rows[0].keys()))
    filename = f"aerovista-{kind}-{datetime.now(timezone.utc).strftime('%Y%m%d')}"
    return _stream_csv(df, filename) if fmt == "csv" else _stream_xlsx(df, filename, sheet=kind.title())


# ===== Password Utility Routines =====
@api.post("/auth/forgot-password")
async def forgot_password(req: ForgotPwdReq):
    user = await db.users.find_one({"email": req.email.lower()})
    if user:
        token = create_token({"sub": user["id"], "purpose": "reset"}, expires_min=30)
        link = f"{os.environ.get('FRONTEND_BASE_URL', 'https://aerovista.pages.dev')}/reset-password?token={token}"
        subj, body = email_mod.tpl_password_reset(user["name"], link)
        await email_mod.send_email(db, user["email"], subj, body, category="password_reset")
    return {"ok": True, "message": "If an account exists, a reset link has been sent."}


@api.post("/auth/reset-password")
async def reset_password(req: ResetPwdReq):
    try:
        from auth import decode_token
        payload = decode_token(req.token)
        if payload.get("purpose") != "reset": raise HTTPException(status_code=400, detail="Token purpose mismatch")
        user_id = payload.get("sub")
    except Exception: raise HTTPException(status_code=400, detail="Expired token structural exception")
    if len(req.new_password) < 6: raise HTTPException(status_code=400, detail="Short password length profile")
    await db.users.update_one({"id": user_id}, {"$set": {"password_hash": hash_password(req.new_password)}})
    return {"ok": True, "message": "Password updated. You can now sign in."}


# ===== Public Reviews Endpoints =====
@api.post("/reviews")
async def submit_review(req: ReviewReq):
    doc = {"id": gen_id(), "name": req.name, "email": req.email, "rating": req.rating, "title": req.title, "review": req.review, "created_at": now_iso(), "published": True}
    await db.reviews.insert_one(doc.copy())
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/reviews")
async def list_reviews(limit: int = 50):
    return await db.reviews.find({"published": True}, PROJECT_NO_ID).sort("created_at", -1).limit(limit).to_list(limit)


# ===== Careers Portal =====
@api.post("/careers/apply")
async def career_apply(req: CareerApplicationReq):
    doc = {"id": gen_id(), "name": req.name, "email": req.email, "mobile": req.mobile, "role_applied": req.role_applied, "experience_years": req.experience_years, "current_company": req.current_company or "", "cover_letter": req.cover_letter, "status": "Received", "created_at": now_iso()}
    await db.career_applications.insert_one(doc.copy())
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/admin/career-applications")
async def admin_career_apps(user=Depends(require_roles("admin"))):
    return await db.career_applications.find({}, PROJECT_NO_ID).sort("created_at", -1).limit(500).to_list(500)


# ===== Pre-departure Upsell Scanner Scheduler Task =====
async def _scan_and_send_upsells(force_pnr: Optional[str] = None) -> dict:
    now = datetime.now(timezone.utc)
    win_low = (now + timedelta(hours=30)).isoformat()
    win_high = (now + timedelta(hours=42)).isoformat()

    query = {"payment_status": "paid", "upsell_sent": {"$ne": True}}
    if force_pnr: query["pnr"] = force_pnr.upper()
    else: query["flight_snapshot.departure_iso"] = {"$gte": win_low, "$lte": win_high}

    bookings = await db.bookings.find(query, PROJECT_NO_ID).limit(200).to_list(200)
    sent = 0
    for b in bookings:
        try:
            f = b.get("flight_snapshot", {})
            subj, body = email_mod.tpl_pre_departure_upsell(b.get("user_email", "Traveller"), b["pnr"], f"{f.get('origin')} → {f.get('destination')}", f.get("departure_date"), f.get("departure_time"), f"{os.environ.get('FRONTEND_BASE_URL', '')}/account")
            await email_mod.send_email(db, b["user_email"], subj, body, category="pre_departure_upsell")
            await db.bookings.update_one({"id": b["id"]}, {"$set": {"upsell_sent": True, "upsell_sent_at": now.isoformat()}})
            sent += 1
        except Exception as e: logger.error(f"Scanner exception: {e}")
    return {"scanned": len(bookings), "sent": sent, "force_pnr": force_pnr}


@api.post("/admin/upsells/scan")
async def admin_scan_upsells(user=Depends(require_roles("admin"))):
    return await _scan_and_send_upsells()


# ===== Router Assembly and Dual-Prefix Mounting Matrix =====
app.include_router(api, prefix="/api")
app.include_router(api)


@app.on_event("shutdown")
async def shutdown_db_client():
    if scheduler.running: scheduler.shutdown(wait=False)
    client.close()

@app.on_event("startup")
async def startup_event():
    if not scheduler.running:
        scheduler.add_job(_scan_and_send_upsells, "interval", hours=1, id="upsell_scan", coalesce=True, max_instances=1, replace_existing=True)
        scheduler.start()
        logger.info("AeroVista Engine Active with dual-prefix route compilation.")
