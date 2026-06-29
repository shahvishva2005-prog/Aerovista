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
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="AeroVista Airlines API")
api = APIRouter(prefix="/api")

# Background scheduler — runs pre-departure upsell scan hourly
from apscheduler.schedulers.asyncio import AsyncIOScheduler
scheduler = AsyncIOScheduler()

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
        # NEVER wipe real customer accounts — only demo accounts and system-seeded data
        await db.users.delete_many({"email": {"$in": [
            "admin@aerovista.com", "pilot@aerovista.com",
            "crew@aerovista.com", "customer@aerovista.com",
        ]}})
        for coll in ["flights", "aircraft", "pilots", "cabin_crew",
                     "bookings", "payments", "refunds", "email_logs",
                     "notifications", "loyalty", "audit_logs",
                     "financial_records", "reviews", "career_applications",
                     "traffic_events"]:
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
    pilot_names = [
        "Vikram Singh", "Aarav Patel", "Rohan Nair", "Karan Kapoor",
        "Aditya Bose", "Sahil Khanna", "Mihir Joshi", "Arjun Reddy",
        "Dev Malhotra", "Ishaan Verma", "Rajat Sinha", "Yash Chauhan",
        "Aniket Deshmukh", "Pranav Mishra", "Siddharth Rao", "Aryan Kulkarni",
        "Nikhil Trivedi", "Varun Bhatt", "Sameer Walia", "Tushar Saxena",
    ]
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

    crew_names = [
        "Priya Iyer", "Neha Gupta", "Tanya Bose", "Sneha Roy", "Riya Das",
        "Aanya Khan", "Meera Pillai", "Anvi Shah", "Diya Chopra", "Kriti Sen",
        "Ishita Menon", "Nandini Joshi", "Pooja Banerjee", "Rhea Saxena", "Tanvi Kapoor",
        "Aditi Rao", "Shreya Malhotra", "Trisha Khanna", "Bhavna Reddy", "Lavanya Pillai",
    ]
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
    # Indian airport set for domestic-vs-international classification
    INDIAN_AIRPORTS = {
        "DEL", "BOM", "BLR", "MAA", "HYD", "CCU", "GOI", "COK", "AMD", "PNQ",
        "JAI", "LKO", "TRV", "IXC", "GAU", "PAT", "NAG", "IXM", "BBI", "IDR",
        "IXR", "VNS", "SXR", "IXJ", "DED",
    }
    # Layover hubs (preferred for international stop-overs)
    LAYOVER_HUBS = ["DXB", "AUH"]
    # Departure-time pool spread through the day
    time_pool = [(5, 30), (6, 45), (7, 30), (8, 15), (9, 0), (10, 30), (11, 45),
                 (13, 15), (14, 30), (15, 45), (17, 0), (18, 30), (19, 45),
                 (21, 0), (22, 30)]
    flights = []
    for r_idx, (org, dst) in enumerate(routes):
        is_domestic = org in INDIAN_AIRPORTS and dst in INDIAN_AIRPORTS
        # Pick a hub that isn't either endpoint
        hub = next((h for h in LAYOVER_HUBS if h not in (org, dst)), "DXB")
        hub_air = airport_by_iata(hub) or {}

        if is_domestic:
            direct_count = random.randint(3, 5)
            layover_count = 0
        else:
            direct_count = 3
            layover_count = 5

        direct_times = random.sample(time_pool, min(direct_count, len(time_pool)))
        direct_times.sort()
        remaining = [t for t in time_pool if t not in direct_times]
        layover_times = random.sample(remaining, min(layover_count, len(remaining)))
        layover_times.sort()

        for d in range(0, 30):
            # ---- Direct flights ----
            for s_idx, sched in enumerate(direct_times):
                dep_dt = (now + timedelta(days=d)).replace(hour=sched[0], minute=sched[1], second=0, microsecond=0)
                duration = _haversine_minutes(org, dst)
                arr_dt = dep_dt + timedelta(minutes=duration)
                aircraft = random.choice(aircraft_docs)
                base = random.choice([3499, 4299, 5499, 7299, 8999, 12499, 18999])
                if not is_domestic:
                    base = random.choice([18999, 24999, 32999, 42999])
                o_air = airport_by_iata(org) or {}
                d_air = airport_by_iata(dst) or {}
                flight = {
                    "id": gen_id(),
                    "flight_number": f"AV{1000 + r_idx * 50 + d * 3 + s_idx:04d}",
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
                    "stops": 0,
                    "layover": None,
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

            # ---- Layover flights (international only) ----
            for s_idx, sched in enumerate(layover_times):
                dep_dt = (now + timedelta(days=d)).replace(hour=sched[0], minute=sched[1], second=0, microsecond=0)
                leg1 = _haversine_minutes(org, hub)
                leg2 = _haversine_minutes(hub, dst)
                layover_mins = random.choice([90, 120, 150, 180, 210])
                total_dur = leg1 + layover_mins + leg2
                arr_dt = dep_dt + timedelta(minutes=total_dur)
                hub_arr = dep_dt + timedelta(minutes=leg1)
                hub_dep = hub_arr + timedelta(minutes=layover_mins)
                aircraft = random.choice(aircraft_docs)
                # Layover fares slightly cheaper than direct international
                base = random.choice([14999, 18999, 22999, 28999])
                o_air = airport_by_iata(org) or {}
                d_air = airport_by_iata(dst) or {}
                flight = {
                    "id": gen_id(),
                    "flight_number": f"AV{2000 + r_idx * 50 + d * 3 + s_idx:04d}",
                    "origin": org, "origin_city": o_air.get("city", org),
                    "destination": dst, "destination_city": d_air.get("city", dst),
                    "departure_date": dep_dt.date().isoformat(),
                    "departure_time": dep_dt.strftime("%H:%M"),
                    "arrival_date": arr_dt.date().isoformat(),
                    "arrival_time": arr_dt.strftime("%H:%M"),
                    "departure_iso": dep_dt.isoformat(),
                    "arrival_iso": arr_dt.isoformat(),
                    "duration_mins": total_dur,
                    "duration": _fmt_duration(total_dur),
                    "stops": 1,
                    "layover": {
                        "airport": hub,
                        "city": hub_air.get("city", hub),
                        "arrival_time": hub_arr.strftime("%H:%M"),
                        "departure_time": hub_dep.strftime("%H:%M"),
                        "layover_mins": layover_mins,
                        "layover_str": _fmt_duration(layover_mins),
                    },
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

    # ===== Financial Records (20 hardcoded for analysis) =====
    fin_records = [
        # (month, type, route, revenue, refunds, profit_margin_pct, season)
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
    fin_docs = []
    for m, kind, route, rev, refs, pm, season in fin_records:
        fin_docs.append({
            "id": gen_id(),
            "month": m,
            "kind": kind,
            "route": route,
            "revenue_inr": rev,
            "refunds_inr": refs,
            "net_inr": rev - refs,
            "profit_margin_pct": pm,
            "season": season,
            "created_at": now.isoformat(),
        })
    await db.financial_records.insert_many(fin_docs)

    # ===== Traffic Events (30 days of synthetic site traffic) =====
    today = now.date()
    traffic_docs = []
    for d in range(0, 30):
        day = today - timedelta(days=29 - d)
        # Peak traffic on weekends + festive months
        base = random.randint(1200, 1800)
        if day.weekday() in (4, 5, 6):
            base = int(base * 1.4)
        if day.month in (11, 12, 3):
            base = int(base * 1.25)
        traffic_docs.append({
            "id": gen_id(),
            "date": day.isoformat(),
            "page_views": base,
            "unique_visitors": int(base * random.uniform(0.55, 0.72)),
            "sessions": int(base * random.uniform(0.7, 0.85)),
            "bounce_rate": round(random.uniform(28, 45), 1),
        })
    await db.traffic_events.insert_many(traffic_docs)

    return {
        "message": "Seeded",
        "users": 4,
        "aircraft": len(aircraft_docs),
        "pilots": len(pilots),
        "crew": len(crew_docs),
        "flights": len(flights),
        "financial_records": len(fin_docs),
        "traffic_events": len(traffic_docs),
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
    # Accept email OR mobile (with or without country code / spaces)
    identifier = (req.email or req.mobile or "").strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="Provide email or mobile number")
    # Decide lookup field
    user = None
    if "@" in identifier:
        user = await db.users.find_one({"email": identifier.lower()})
    else:
        # Normalize mobile: keep digits only for matching
        digits = "".join(ch for ch in identifier if ch.isdigit())
        if len(digits) < 7:
            raise HTTPException(status_code=400, detail="Invalid mobile number")
        # Try exact match first, then suffix match (handles +91 prefix variants)
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


# ===== Flights =====
@api.post("/flights/search")
async def search_flights(req: FlightSearchReq):
    query = {
        "origin": req.origin.upper(),
        "destination": req.destination.upper(),
        "departure_date": req.departure_date,
    }
    # Real-time filter: hide flights whose departure has already passed
    now = datetime.now(timezone.utc)
    query["departure_iso"] = {"$gte": now.isoformat()}
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
    import secrets
    # Exclude ambiguous characters: 0, O, 1, I
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return prefix + "".join(secrets.choice(alphabet) for _ in range(n))


@api.post("/bookings")
async def create_booking(req: CreateBookingReq, user=Depends(get_current_user)):
    flight = await db.flights.find_one({"id": req.flight_id}, PROJECT_NO_ID)
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")

    # Real-time guard: cannot book a flight whose departure has already passed
    dep_dt = datetime.fromisoformat(flight["departure_iso"])
    now = datetime.now(timezone.utc)
    if dep_dt <= now:
        raise HTTPException(status_code=400,
                            detail="This flight has already departed. Please pick an upcoming flight.")

    # Recompute pricing
    ratio = (flight.get("available_seats", 1) or 1) / max(1, flight.get("total_seats", 1))
    mult = {"economy": 1.0, "premium_economy": 1.6, "business": 2.8, "first": 4.5}.get(req.cabin_class, 1.0)
    base_per_pax, _ = _calc_dynamic_price(flight["base_price"] * mult, dep_dt, ratio)
    n_pax = len(req.passengers)
    base = round(base_per_pax * n_pax, 2)

    # Concession: 20% off for medical personnel + armed forces per qualifying pax
    concession_pax = sum(1 for p in req.passengers if p.is_medical or p.is_armed_forces)
    concession = round(base_per_pax * 0.20 * concession_pax, 2)

    addons = 0
    if req.add_baggage:
        addons += 800 * n_pax
    if req.add_insurance:
        addons += 250 * n_pax
    # meals
    addons += 350 * len([m for m in req.meal_preferences if m and m != "standard"])

    discount = concession
    promo = (req.promo_code or "").upper().strip()
    if promo == "HDFC10":
        discount += round(base * 0.10, 2)
    elif promo == "ICICI200":
        discount += 200
    elif promo == "AXIS5":
        discount += round(base * 0.05, 2)
    elif promo == "SBI500":
        discount += 500

    # Corporate discount: flat 5% off base when corporate block present
    corporate_block = (req.billing.model_dump().get("corporate") or {}) if req.billing else {}
    if corporate_block and corporate_block.get("company_name"):
        discount += round(base * 0.05, 2)

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
            "discount": discount, "concession": concession,
            "taxes": taxes, "convenience": convenience, "total": total,
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


@api.get("/admin/charts/bookings-trend")
async def admin_bookings_trend(days: int = 30, user=Depends(require_roles("admin"))):
    """Bookings count per day for the last N days."""
    today = datetime.now(timezone.utc).date()
    series = []
    for i in range(days, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        count = await db.bookings.count_documents({"booked_at": {"$regex": f"^{d}"}})
        series.append({"date": d, "bookings": count})
    return series


@api.get("/admin/charts/occupancy")
async def admin_occupancy(user=Depends(require_roles("admin"))):
    """Average occupancy across upcoming flights, plus per-cabin-class booking split."""
    now_iso = datetime.now(timezone.utc).isoformat()
    pipe_occ = [
        {"$match": {"departure_iso": {"$gte": now_iso}}},
        {"$project": {
            "occupied": {"$subtract": ["$total_seats", "$available_seats"]},
            "total": "$total_seats",
        }},
        {"$group": {"_id": None, "occupied": {"$sum": "$occupied"}, "total": {"$sum": "$total"}}},
    ]
    occ_agg = await db.flights.aggregate(pipe_occ).to_list(1)
    occ_pct = 0
    if occ_agg and occ_agg[0]["total"]:
        occ_pct = round(occ_agg[0]["occupied"] / occ_agg[0]["total"] * 100, 1)

    # Per cabin class booking split
    pipe_class = [
        {"$group": {"_id": "$cabin_class", "count": {"$sum": 1}, "revenue": {"$sum": "$fare.total"}}},
    ]
    cls_agg = await db.bookings.aggregate(pipe_class).to_list(10)
    cabin_split = [{"class": c["_id"] or "economy", "count": c["count"], "revenue": round(c["revenue"] or 0, 2)}
                   for c in cls_agg]

    # Refund status split
    pipe_ref = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    ref_agg = await db.refunds.aggregate(pipe_ref).to_list(10)
    refund_split = [{"status": r["_id"], "count": r["count"]} for r in ref_agg]

    return {"occupancy_pct": occ_pct, "cabin_split": cabin_split, "refund_split": refund_split}


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


# ===== Pre-departure Upsell Scanner =====
async def _scan_and_send_upsells(force_pnr: Optional[str] = None) -> dict:
    """Find paid bookings departing in ~36h that haven't been upsold yet, and email them.

    Window: 30h <= time_to_departure <= 42h. Idempotent via booking.upsell_sent flag.
    Pass force_pnr to bypass time-window check for testing.
    """
    now = datetime.now(timezone.utc)
    win_low = (now + timedelta(hours=30)).isoformat()
    win_high = (now + timedelta(hours=42)).isoformat()

    query = {"payment_status": "paid", "upsell_sent": {"$ne": True}}
    if force_pnr:
        query["pnr"] = force_pnr.upper()
    else:
        query["flight_snapshot.departure_iso"] = {"$gte": win_low, "$lte": win_high}

    bookings = await db.bookings.find(query, PROJECT_NO_ID).limit(200).to_list(200)
    sent = 0
    errors = []
    for b in bookings:
        try:
            f = b.get("flight_snapshot", {})
            route = f"{f.get('origin','')} → {f.get('destination','')}"
            link = f"{os.environ.get('FRONTEND_BASE_URL', '')}/account"
            name = (b.get("billing", {}) or {}).get("contact_name") or b.get("user_email", "Traveller")
            subj, body = email_mod.tpl_pre_departure_upsell(
                name.split(" ")[0], b["pnr"], route,
                f.get("departure_date", ""), f.get("departure_time", ""), link,
            )
            await email_mod.send_email(db, b["user_email"], subj, body, category="pre_departure_upsell")
            await db.bookings.update_one(
                {"id": b["id"]},
                {"$set": {"upsell_sent": True, "upsell_sent_at": now.isoformat()}},
            )
            sent += 1
        except Exception as e:
            errors.append({"booking_id": b.get("id"), "error": str(e)})
    return {"scanned": len(bookings), "sent": sent, "errors": errors,
            "window": {"from": win_low, "to": win_high}, "force_pnr": force_pnr}


@api.post("/admin/upsells/scan")
async def admin_scan_upsells(user=Depends(require_roles("admin"))):
    """Manually trigger the pre-departure upsell scan. Runs automatically every hour as well."""
    result = await _scan_and_send_upsells()
    return result


@api.post("/admin/upsells/send/{pnr}")
async def admin_send_upsell_now(pnr: str, user=Depends(require_roles("admin"))):
    """Send a pre-departure upsell email to a specific PNR right now (bypasses 36h window).
    Useful for testing. Marks booking as upsell_sent=true."""
    result = await _scan_and_send_upsells(force_pnr=pnr)
    if result["sent"] == 0:
        raise HTTPException(status_code=404,
                            detail="Booking not found, not paid, or already upsold")
    return result


# ===== Admin Exports (CSV / Excel) =====
def _df_from_records(records, columns):
    import pandas as pd
    return pd.DataFrame(records, columns=columns)


def _stream_csv(df, filename: str):
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    bio = io.BytesIO(buf.getvalue().encode("utf-8"))
    return StreamingResponse(bio, media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={filename}.csv"})


def _stream_xlsx(df, filename: str, sheet: str = "Sheet1"):
    bio = io.BytesIO()
    with __import__("pandas").ExcelWriter(bio, engine="openpyxl") as w:
        df.to_excel(w, index=False, sheet_name=sheet)
    bio.seek(0)
    return StreamingResponse(bio, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f"attachment; filename={filename}.xlsx"})


async def _export_bookings_rows():
    items = await db.bookings.find({}, PROJECT_NO_ID).sort("booked_at", -1).limit(5000).to_list(5000)
    rows = []
    for b in items:
        f = b.get("flight_snapshot", {})
        rows.append({
            "PNR": b.get("pnr"),
            "Ticket": b.get("ticket_number"),
            "Customer Email": b.get("user_email"),
            "Flight": f.get("flight_number"),
            "From": f.get("origin"), "To": f.get("destination"),
            "Date": f.get("departure_date"), "Time": f.get("departure_time"),
            "Cabin": b.get("cabin_class"),
            "Passengers": len(b.get("passengers", [])),
            "Status": b.get("status"),
            "Payment Status": b.get("payment_status"),
            "Amount": b.get("fare", {}).get("total", 0),
            "Booked At": b.get("booked_at"),
        })
    return rows


async def _export_payments_rows():
    items = await db.payments.find({}, PROJECT_NO_ID).sort("paid_at", -1).limit(5000).to_list(5000)
    return [{"Transaction ID": p.get("transaction_id"), "Booking ID": p.get("booking_id"),
             "Method": p.get("method"), "Amount": p.get("amount"), "Currency": p.get("currency"),
             "Status": p.get("status"), "Bank": p.get("bank"), "Paid At": p.get("paid_at")} for p in items]


async def _export_customers_rows():
    items = await db.users.find({"role": "customer"}, {"_id": 0, "password_hash": 0}).limit(5000).to_list(5000)
    return [{"Name": c.get("name"), "Email": c.get("email"), "Mobile": c.get("mobile"),
             "Loyalty Tier": c.get("loyalty_tier"), "Points": c.get("loyalty_points", 0),
             "Joined": c.get("created_at")} for c in items]


async def _export_refunds_rows():
    items = await db.refunds.find({}, PROJECT_NO_ID).sort("created_at", -1).limit(5000).to_list(5000)
    return [{"Refund ID": r.get("refund_id"), "PNR": r.get("pnr"), "Amount": r.get("amount"),
             "Reason": r.get("reason"), "Status": r.get("status"), "Created At": r.get("created_at")} for r in items]


async def _export_flights_rows():
    items = await db.flights.find({}, PROJECT_NO_ID).sort("departure_iso", 1).limit(2000).to_list(2000)
    return [{"Flight": f.get("flight_number"), "From": f.get("origin"), "To": f.get("destination"),
             "Date": f.get("departure_date"), "Departure": f.get("departure_time"),
             "Arrival": f.get("arrival_time"), "Aircraft": f.get("aircraft"),
             "Total Seats": f.get("total_seats"), "Available": f.get("available_seats"),
             "Base Price": f.get("base_price"), "Status": f.get("status")} for f in items]


async def _export_financials_rows():
    items = await db.financial_records.find({}, PROJECT_NO_ID).sort("month", 1).limit(5000).to_list(5000)
    return [{
        "Month": r.get("month"), "Kind": r.get("kind"), "Route": r.get("route"),
        "Revenue (INR)": r.get("revenue_inr"), "Refunds (INR)": r.get("refunds_inr"),
        "Net (INR)": r.get("net_inr"), "Profit Margin %": r.get("profit_margin_pct"),
        "Season": r.get("season"),
    } for r in items]


EXPORT_MAP = {
    "bookings": (_export_bookings_rows, None),
    "payments": (_export_payments_rows, None),
    "customers": (_export_customers_rows, None),
    "refunds": (_export_refunds_rows, None),
    "flights": (_export_flights_rows, None),
    "financials": (_export_financials_rows, None),
}


@api.get("/admin/exports/{kind}.{fmt}")
async def admin_export(kind: str, fmt: str, user=Depends(require_roles("admin"))):
    if kind not in EXPORT_MAP:
        raise HTTPException(status_code=400, detail="Unknown export kind")
    if fmt not in ("csv", "xlsx"):
        raise HTTPException(status_code=400, detail="Format must be csv or xlsx")
    rows_fn, _ = EXPORT_MAP[kind]
    rows = await rows_fn()
    if not rows:
        rows = [{"info": "No data"}]
    df = _df_from_records(rows, list(rows[0].keys()))
    filename = f"aerovista-{kind}-{datetime.now(timezone.utc).strftime('%Y%m%d')}"
    return _stream_csv(df, filename) if fmt == "csv" else _stream_xlsx(df, filename, sheet=kind.title())


@api.get("/admin/revenue-report.{fmt}")
async def admin_revenue_report(fmt: str, user=Depends(require_roles("admin"))):
    if fmt not in ("csv", "xlsx"):
        raise HTTPException(status_code=400, detail="Format must be csv or xlsx")
    # Aggregate by date
    pipe = [
        {"$match": {"paid_at": {"$ne": None}}},
        {"$project": {"date": {"$substr": ["$paid_at", 0, 10]}, "amount": "$amount", "method": "$method"}},
        {"$group": {"_id": "$date", "transactions": {"$sum": 1}, "revenue": {"$sum": "$amount"}}},
        {"$sort": {"_id": 1}},
    ]
    agg = await db.payments.aggregate(pipe).to_list(5000)
    rows = [{"Date": a["_id"], "Transactions": a["transactions"], "Revenue (INR)": round(a["revenue"], 2)} for a in agg]
    if not rows:
        rows = [{"Date": "-", "Transactions": 0, "Revenue (INR)": 0}]
    df = _df_from_records(rows, ["Date", "Transactions", "Revenue (INR)"])
    fn = f"aerovista-revenue-{datetime.now(timezone.utc).strftime('%Y%m%d')}"
    return _stream_csv(df, fn) if fmt == "csv" else _stream_xlsx(df, fn, sheet="Revenue")


# ===== Password Reset =====
@api.post("/auth/forgot-password")
async def forgot_password(req: ForgotPwdReq):
    user = await db.users.find_one({"email": req.email.lower()})
    # Always respond 200 to avoid leaking which emails exist
    if user:
        token = create_token({"sub": user["id"], "purpose": "reset"}, expires_min=30)
        link = f"{os.environ.get('FRONTEND_BASE_URL', 'https://sky-booking-hub-1.preview.emergentagent.com')}/reset-password?token={token}"
        subj, body = email_mod.tpl_password_reset(user["name"], link)
        await email_mod.send_email(db, user["email"], subj, body, category="password_reset")
    else:
        # Log the attempt so admins can debug "I didn't receive an email"
        await db.email_logs.insert_one({
            "id": gen_id(),
            "to_email": req.email.lower(),
            "subject": "[NOT SENT] Password reset for non-existent account",
            "category": "password_reset_no_user",
            "status": "skipped",
            "error_message": "No account exists for this email address",
            "sent_at": None,
            "created_at": now_iso(),
            "has_attachments": False,
            "attachment_count": 0,
        })
    return {"ok": True, "message": "If an account exists for this email, a reset link has been sent. Please also check your Spam / Promotions folder."}


@api.post("/admin/password-reset-link")
async def admin_generate_reset_link(
    email: str = Body(..., embed=True),
    user=Depends(require_roles("admin")),
):
    """Generate a password reset link for a customer without sending email.
    Useful when SMTP delivery fails or user can't find the email."""
    target = await db.users.find_one({"email": email.lower()})
    if not target:
        raise HTTPException(status_code=404, detail="No user with that email")
    token = create_token({"sub": target["id"], "purpose": "reset"}, expires_min=60)
    link = f"{os.environ.get('FRONTEND_BASE_URL', '')}/reset-password?token={token}"
    return {"user": target.get("email"), "name": target.get("name"),
            "reset_link": link, "expires_minutes": 60}


@api.post("/auth/reset-password")
async def reset_password(req: ResetPwdReq):
    try:
        from auth import decode_token
        payload = decode_token(req.token)
        if payload.get("purpose") != "reset":
            raise HTTPException(status_code=400, detail="Invalid token")
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    await db.users.update_one({"id": user_id}, {"$set": {"password_hash": hash_password(req.new_password)}})
    return {"ok": True, "message": "Password updated. You can now sign in."}


# ===== Pilot Portal =====
@api.get("/pilot/flights")
async def pilot_flights(user=Depends(require_roles("pilot"))):
    pilot = await db.pilots.find_one({"name": user["name"]}, PROJECT_NO_ID)
    if not pilot:
        # Fallback: assign the seeded "pilot@aerovista.com" account to the first roster pilot
        pilot = await db.pilots.find_one({}, PROJECT_NO_ID, sort=[("employee_id", 1)])
    pilot_id = pilot["id"] if pilot else None
    query = {"pilot_id": pilot_id} if pilot_id else {}
    items = await db.flights.find(query, PROJECT_NO_ID).sort("departure_iso", 1).limit(50).to_list(50)

    # Hydrate the crew list for each assigned flight
    crew_ids = []
    for f in items:
        crew_ids += f.get("crew_ids", [])
    crew_by_id = {}
    if crew_ids:
        crew_docs = await db.cabin_crew.find({"id": {"$in": list(set(crew_ids))}}, PROJECT_NO_ID).to_list(200)
        crew_by_id = {c["id"]: c for c in crew_docs}
    for f in items:
        f["crew"] = [crew_by_id.get(cid) for cid in f.get("crew_ids", []) if crew_by_id.get(cid)]

    # All cabin crew on roster (for the "Roster" tab on the portal)
    roster = await db.cabin_crew.find({}, PROJECT_NO_ID).sort("employee_id", 1).to_list(200)
    return {"pilot": pilot, "flights": items, "cabin_crew_roster": roster}


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


# ===== Traffic Pixel (public, no auth) =====
@api.post("/track/event")
async def track_event(payload: dict = Body(...)):
    """Lightweight traffic-pixel endpoint. Frontend pings this on route changes
    so the admin dashboard's traffic chart reflects real visits in addition to
    the seeded baseline. Stores per-day rollups in `traffic_events`."""
    today_str = datetime.now(timezone.utc).date().isoformat()
    path = (payload or {}).get("path", "/")[:120]
    await db.traffic_events.update_one(
        {"date": today_str, "live": True},
        {"$inc": {"page_views": 1}, "$setOnInsert": {
            "id": gen_id(),
            "date": today_str,
            "live": True,
            "unique_visitors": 0,
            "sessions": 0,
            "bounce_rate": 0,
        }, "$push": {"recent_paths": {"$each": [path], "$slice": -25}}},
        upsert=True,
    )
    return {"ok": True}


# ===== Admin Extra Charts =====
@api.get("/admin/charts/traffic")
async def admin_charts_traffic(days: int = 30, user=Depends(require_roles("admin"))):
    """Daily site traffic (page_views, unique_visitors) for the last N days."""
    today = datetime.now(timezone.utc).date()
    start_iso = (today - timedelta(days=days)).isoformat()
    # Aggregate by date — combine seeded + live rows by date
    pipe = [
        {"$match": {"date": {"$gte": start_iso}}},
        {"$group": {"_id": "$date",
                    "page_views": {"$sum": "$page_views"},
                    "unique_visitors": {"$sum": "$unique_visitors"},
                    "sessions": {"$sum": "$sessions"}}},
        {"$sort": {"_id": 1}},
    ]
    rows = await db.traffic_events.aggregate(pipe).to_list(500)
    return [{"date": r["_id"], "page_views": r["page_views"],
             "unique_visitors": r["unique_visitors"], "sessions": r["sessions"]} for r in rows]


@api.get("/admin/charts/user-growth")
async def admin_charts_user_growth(days: int = 30, user=Depends(require_roles("admin"))):
    """Cumulative user signups for the last N days (customer role only)."""
    today = datetime.now(timezone.utc).date()
    pipe = [
        {"$match": {"role": "customer"}},
        {"$project": {"day": {"$substr": ["$created_at", 0, 10]}}},
        {"$group": {"_id": "$day", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    rows = await db.users.aggregate(pipe).to_list(500)
    by_day = {r["_id"]: r["count"] for r in rows}
    series = []
    cumulative = 0
    # backfill: include any prior signups as base
    for r in rows:
        if r["_id"] < (today - timedelta(days=days)).isoformat():
            cumulative += r["count"]
    for i in range(days, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        cumulative += by_day.get(d, 0)
        series.append({"date": d, "users": cumulative, "new": by_day.get(d, 0)})
    return series


@api.get("/admin/charts/seasons")
async def admin_charts_seasons(user=Depends(require_roles("admin"))):
    """Revenue split by Peak / Mid / Off season (uses financial_records.season)."""
    pipe = [
        {"$group": {"_id": "$season",
                    "revenue": {"$sum": "$revenue_inr"},
                    "refunds": {"$sum": "$refunds_inr"},
                    "records": {"$sum": 1}}},
    ]
    rows = await db.financial_records.aggregate(pipe).to_list(10)
    return [{"season": r["_id"] or "Off", "revenue": r["revenue"],
             "refunds": r["refunds"], "records": r["records"]} for r in rows]


@api.get("/admin/charts/festivals")
async def admin_charts_festivals(user=Depends(require_roles("admin"))):
    """Curated festival calendar with revenue uplift % proxy from financial_records."""
    # Group by month; map Diwali (Oct-Nov), Christmas (Dec), Holi (Mar) etc.
    festivals = [
        {"name": "Diwali Travel", "months": ["2025-10", "2025-11"], "icon": "diya"},
        {"name": "Christmas & New Year", "months": ["2025-12", "2026-01"], "icon": "tree"},
        {"name": "Holi Getaway", "months": ["2026-03"], "icon": "colors"},
        {"name": "Summer Family", "months": ["2026-05", "2026-06"], "icon": "sun"},
        {"name": "Eid Travel", "months": ["2026-04"], "icon": "moon"},
    ]
    out = []
    for f in festivals:
        pipe = [
            {"$match": {"month": {"$in": f["months"]}}},
            {"$group": {"_id": None, "rev": {"$sum": "$revenue_inr"}}},
        ]
        agg = await db.financial_records.aggregate(pipe).to_list(1)
        rev = agg[0]["rev"] if agg else 0
        out.append({"name": f["name"], "revenue": rev, "months": f["months"], "icon": f["icon"]})
    return out


# ===== Financial Records (Read / Export / Import) =====
@api.get("/admin/financial-records")
async def admin_financial_records(user=Depends(require_roles("admin"))):
    items = await db.financial_records.find({}, PROJECT_NO_ID).sort("month", 1).limit(500).to_list(500)
    return items


@api.post("/admin/financial-records/import")
async def admin_financial_import(payload: dict = Body(...),
                                 user=Depends(require_roles("admin"))):
    """Import financial records from CSV/Excel content as JSON rows.

    Body shape: {"rows": [{Month, Kind, Route, Revenue (INR), ...}, ...]}
    Existing month+route+kind are upserted; new rows are inserted.
    """
    rows = payload.get("rows", [])
    if not isinstance(rows, list):
        raise HTTPException(status_code=400, detail="rows must be a list")
    inserted = 0
    updated = 0
    for r in rows:
        try:
            month = str(r.get("Month") or r.get("month") or "").strip()
            kind = str(r.get("Kind") or r.get("kind") or "Route P&L").strip()
            route = str(r.get("Route") or r.get("route") or "ALL").strip()
            rev = float(r.get("Revenue (INR)") or r.get("revenue_inr") or 0)
            refs = float(r.get("Refunds (INR)") or r.get("refunds_inr") or 0)
            pm = float(r.get("Profit Margin %") or r.get("profit_margin_pct") or 0)
            season = str(r.get("Season") or r.get("season") or "Off").strip()
            if not month:
                continue
            doc = {
                "month": month, "kind": kind, "route": route,
                "revenue_inr": rev, "refunds_inr": refs, "net_inr": rev - refs,
                "profit_margin_pct": pm, "season": season,
                "imported_at": now_iso(),
            }
            res = await db.financial_records.update_one(
                {"month": month, "kind": kind, "route": route},
                {"$set": doc, "$setOnInsert": {"id": gen_id(), "created_at": now_iso()}},
                upsert=True,
            )
            if res.upserted_id:
                inserted += 1
            elif res.modified_count:
                updated += 1
        except Exception as e:
            logger.warning(f"Skipped row: {e}")
    return {"ok": True, "inserted": inserted, "updated": updated, "total": len(rows)}


# ===== Reviews =====
@api.post("/reviews")
async def submit_review(req: ReviewReq):
    """Public reviews endpoint — stores in db.reviews and emails airlinesaerovista@gmail.com."""
    doc = {
        "id": gen_id(),
        "name": req.name, "email": req.email,
        "rating": req.rating,
        "flight_number": req.flight_number or "",
        "pnr": req.pnr or "",
        "title": req.title,
        "review": req.review,
        "created_at": now_iso(),
        "published": True,
    }
    await db.reviews.insert_one(doc.copy())
    safe = {k: v for k, v in doc.items() if k != "_id"}

    # Notify admin inbox
    subj = f"[Review] {req.rating}★ — {req.title}"
    body = email_mod._wrap_template(
        "New Customer Review",
        f"<p><strong>{req.name}</strong> &lt;{req.email}&gt; rated <strong>{req.rating}/5</strong></p>"
        f"<p><strong>Flight:</strong> {req.flight_number or '-'} &nbsp; <strong>PNR:</strong> {req.pnr or '-'}</p>"
        f"<p><strong>{req.title}</strong></p>"
        f"<blockquote style='border-left:3px solid #D4AF37;padding-left:14px;color:#333;'>{req.review}</blockquote>",
    )
    await email_mod.send_email(db, "airlinesaerovista@gmail.com", subj, body, category="review")
    # Also email a thank-you to the reviewer
    thanks_subj = "Thank you for your AeroVista review"
    thanks_body = email_mod._wrap_template(
        f"Thank you, {req.name}",
        f"<p>Your {req.rating}-star review has been received. Our team reads every word — it helps us serve you better above and beyond.</p>",
    )
    await email_mod.send_email(db, req.email, thanks_subj, thanks_body, category="review_ack")
    return safe


@api.get("/reviews")
async def list_reviews(limit: int = 50):
    items = await db.reviews.find({"published": True}, PROJECT_NO_ID).sort("created_at", -1).limit(limit).to_list(limit)
    return items


@api.get("/admin/reviews")
async def admin_reviews(user=Depends(require_roles("admin"))):
    items = await db.reviews.find({}, PROJECT_NO_ID).sort("created_at", -1).limit(500).to_list(500)
    return items


# ===== Careers =====
@api.post("/careers/apply")
async def career_apply(req: CareerApplicationReq):
    """Public career application endpoint. Stores in db.career_applications,
    emails airlinesaerovista@gmail.com with resume attached (PDF, ≤5MB)."""
    import base64
    resume_bytes = b""
    if req.resume_base64:
        try:
            resume_bytes = base64.b64decode(req.resume_base64)
            if len(resume_bytes) > 5 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="Resume must be ≤ 5MB")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid resume encoding")

    doc = {
        "id": gen_id(),
        "name": req.name, "email": req.email, "mobile": req.mobile,
        "role_applied": req.role_applied,
        "experience_years": req.experience_years,
        "current_company": req.current_company or "",
        "cover_letter": req.cover_letter,
        "resume_filename": req.resume_filename or "",
        "resume_size_bytes": len(resume_bytes),
        "status": "Received",
        "created_at": now_iso(),
    }
    await db.career_applications.insert_one(doc.copy())

    # Notify careers inbox with resume attachment
    attachments = []
    if resume_bytes and req.resume_filename:
        attachments.append((req.resume_filename, resume_bytes))
    subj = f"[Careers] {req.role_applied} — {req.name}"
    body = email_mod._wrap_template(
        f"New Application: {req.role_applied}",
        f"<p><strong>{req.name}</strong> &lt;{req.email}&gt; • {req.mobile}</p>"
        f"<p><strong>Experience:</strong> {req.experience_years} yrs &nbsp; "
        f"<strong>Current Company:</strong> {req.current_company or '-'}</p>"
        f"<p><strong>Cover Letter</strong></p>"
        f"<blockquote style='border-left:3px solid #D4AF37;padding-left:14px;color:#333;'>{req.cover_letter}</blockquote>"
        f"<p style='color:#777;font-size:12px;'>Resume attached: {req.resume_filename or 'none'}</p>",
    )
    await email_mod.send_email(db, "airlinesaerovista@gmail.com", subj, body,
                               attachments=attachments, category="career_application")
    # Acknowledgement to applicant
    ack_subj = f"We've received your application — {req.role_applied}"
    ack_body = email_mod._wrap_template(
        f"Hello {req.name}",
        f"<p>Thank you for applying for the <strong>{req.role_applied}</strong> role at AeroVista Airlines.</p>"
        f"<p>Our People & Culture team reviews every application within 7 business days. "
        f"If your profile matches, you'll hear from us with next steps.</p>",
    )
    await email_mod.send_email(db, req.email, ack_subj, ack_body, category="career_ack")

    safe = {k: v for k, v in doc.items() if k != "_id"}
    return safe


@api.get("/admin/career-applications")
async def admin_career_apps(user=Depends(require_roles("admin"))):
    items = await db.career_applications.find({}, PROJECT_NO_ID).sort("created_at", -1).limit(500).to_list(500)
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
    if scheduler.running:
        scheduler.shutdown(wait=False)
    client.close()


@app.on_event("startup")
async def startup_event():
    # Schedule the pre-departure upsell scanner to run every hour
    if not scheduler.running:
        scheduler.add_job(_scan_and_send_upsells, "interval", hours=1, id="upsell_scan",
                          coalesce=True, max_instances=1, replace_existing=True)
        scheduler.start()
        logger.info("Started APScheduler with hourly pre-departure upsell scan")


# 🌟 APPLICATION INITIALIZATION 
app = FastAPI(title="AeroVista Airlines API")

# 🔒 STEP 1: RESOLVED CORS MIDDLEWARE (Fixes wildcard vs credential conflict)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Now fully allowed by the browser because credentials is False
    allow_credentials=False,  # Unblocks the wildcard conflict (Bearer tokens work perfectly)
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🛠️ STEP 2: ROUTERS DEFINITION
api = APIRouter()
