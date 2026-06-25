"""
AeroVista Airlines - End-to-end backend tests.
Covers: airports, seed, stats, auth, search, flight detail+seatmap,
booking, payment, PDFs, refund, track, admin, pilot, crew.
"""

import os
import io
import random
import string
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sky-booking-hub-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@aerovista.com", "password": "Admin@123"}
PILOT = {"email": "pilot@aerovista.com", "password": "Pilot@123"}
CREW = {"email": "crew@aerovista.com", "password": "Crew@123"}


def _rand_suffix(n=8):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def _post(path, json=None, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.post(f"{API}{path}", json=json, headers=h, timeout=45)


def _get(path, token=None, **kw):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.get(f"{API}{path}", headers=h, timeout=45, **kw)


# ===================================================================
# Phase 0 - Seed
# ===================================================================
@pytest.fixture(scope="session", autouse=True)
def seed():
    r = _post("/admin/seed")
    assert r.status_code == 200, f"Seed failed: {r.status_code} {r.text}"


# ===================================================================
# Airports / Stats / Health
# ===================================================================
def test_airports_returns_200_plus():
    r = _get("/airports")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 200, f"Expected >=200 airports, got {len(data)}"


def test_airports_search_dubai():
    r = _get("/airports", params={"q": "Dubai"})
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    blob = " ".join(str(a).lower() for a in data)
    assert "dubai" in blob


def test_admin_seed_idempotent():
    r = _post("/admin/seed")
    assert r.status_code == 200
    body = r.json()
    # accept either "Already seeded" with users, or seed counts
    assert "users" in body or "user" in body or "message" in body


def test_stats():
    r = _get("/stats")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, dict)


# ===================================================================
# Auth
# ===================================================================
@pytest.fixture(scope="session")
def fresh_customer():
    email = f"e2e-test-{_rand_suffix()}@aerovista.com"
    password = "Test@1234"
    r = _post("/auth/register", {"name": "E2E Test", "email": email, "password": password, "mobile": "+919000000000"})
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    body = r.json()
    assert "access_token" in body and body["user"]["email"] == email
    return {"email": email, "password": password, "token": body["access_token"], "user": body["user"]}


def test_register_login_me(fresh_customer):
    # Login again with same creds
    r = _post("/auth/login", {"email": fresh_customer["email"], "password": fresh_customer["password"]})
    assert r.status_code == 200
    tok = r.json()["access_token"]
    me = _get("/auth/me", token=tok)
    assert me.status_code == 200
    assert me.json()["email"] == fresh_customer["email"]


@pytest.fixture(scope="session")
def admin_token():
    r = _post("/auth/login", ADMIN)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    body = r.json()
    assert body["user"]["role"] == "admin"
    return body["access_token"]


@pytest.fixture(scope="session")
def pilot_token():
    r = _post("/auth/login", PILOT)
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "pilot"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def crew_token():
    r = _post("/auth/login", CREW)
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "crew"
    return r.json()["access_token"]


# ===================================================================
# Flight search / detail
# ===================================================================
@pytest.fixture(scope="session")
def search_results():
    dep_date = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")
    payload = {
        "origin": "DEL", "destination": "BOM", "departure_date": dep_date,
        "trip_type": "one_way", "passengers": 1, "cabin_class": "economy",
    }
    r = _post("/flights/search", payload)
    assert r.status_code == 200, f"search failed: {r.status_code} {r.text}"
    data = r.json()
    outbound = data.get("outbound") or data.get("flights") or []
    assert isinstance(outbound, list)
    assert len(outbound) >= 1, f"No outbound flights for DEL-BOM on {dep_date}"
    f0 = outbound[0]
    assert "price" in f0 or "fare" in f0 or "total" in f0
    return {"date": dep_date, "outbound": outbound}


def test_flight_search_returns_outbound_with_price(search_results):
    f0 = search_results["outbound"][0]
    # price_reasons should be present (dynamic pricing explainer)
    assert "price_reasons" in f0 or "reasons" in f0 or any(k for k in f0.keys() if "reason" in k.lower())


def test_flight_detail_has_seatmap(search_results):
    f0 = search_results["outbound"][0]
    fid = f0["id"]
    r = _get(f"/flights/{fid}")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == fid
    seatmap = body.get("seat_map") or body.get("seats")
    assert seatmap, "Expected seat_map to be populated"


# ===================================================================
# End-to-end booking flow
# ===================================================================
@pytest.fixture(scope="session")
def booking(fresh_customer, search_results):
    f0 = search_results["outbound"][0]
    fid = f0["id"]
    # fetch detail to choose a seat
    det = _get(f"/flights/{fid}").json()
    seat_map = det.get("seat_map") or []
    chosen = None
    # seat_map is list of dicts; find available economy seat
    for s in seat_map:
        if s.get("available", True) and s.get("class", s.get("cabin", "economy")) in ("economy", "Economy", "E"):
            chosen = s.get("seat_no") or s.get("number") or s.get("id")
            if chosen:
                break
    if not chosen and seat_map:
        s = seat_map[0]
        chosen = s.get("seat_no") or s.get("number") or s.get("id")
    seats = [chosen] if chosen else []

    payload = {
        "flight_id": fid,
        "cabin_class": "economy",
        "passengers": [{
            "title": "Mr", "first_name": "E2E", "last_name": "Tester",
            "gender": "M", "nationality": "Indian",
        }],
        "seat_numbers": seats,
        "meal_preferences": ["standard"],
        "add_baggage": False,
        "add_insurance": False,
        "billing": {
            "contact_name": "E2E Tester",
            "contact_email": fresh_customer["email"],
            "contact_mobile": "+919000000000",
            "address_line1": "1 Test Street",
            "city": "Delhi", "state": "DL", "postal_code": "110001",
            "country": "India",
        },
        "promo_code": "",
    }
    r = _post("/bookings", payload, token=fresh_customer["token"])
    assert r.status_code == 200, f"booking create failed: {r.status_code} {r.text}"
    bk = r.json()
    assert bk["status"] == "pending_payment"
    assert bk["pnr"].startswith("AV")
    return bk


def test_booking_created(booking):
    assert booking["fare"]["total"] > 0


def test_pay_booking_and_pdfs(fresh_customer, booking):
    bid = booking["id"]
    pay_payload = {
        "booking_id": bid,
        "method": "credit_card",
        "card_holder": "E2E Tester",
        "card_number_last4": "4242",
        "bank": "HDFC",
    }
    r = _post(f"/bookings/{bid}/pay", pay_payload, token=fresh_customer["token"])
    assert r.status_code == 200, f"pay failed: {r.status_code} {r.text}"
    paid = r.json()
    assert paid["payment"]["status"] == "success"

    # confirm booking
    g = _get(f"/bookings/{bid}", token=fresh_customer["token"])
    assert g.status_code == 200
    gb = g.json()
    assert gb["status"] == "confirmed"
    assert gb["payment_status"] == "paid"

    # PDFs
    for kind in ["ticket.pdf", "invoice.pdf", "receipt.pdf", "boarding-pass.pdf"]:
        pr = _get(f"/bookings/{bid}/{kind}", token=fresh_customer["token"])
        assert pr.status_code == 200, f"{kind} -> {pr.status_code}"
        ctype = pr.headers.get("content-type", "")
        assert "application/pdf" in ctype, f"{kind} ctype={ctype}"
        assert len(pr.content) > 200, f"{kind} body too small ({len(pr.content)} bytes)"


def test_track_with_pnr(booking):
    pnr = booking["pnr"]
    r = _post("/track", {"pnr": pnr, "last_name": "Tester"})
    # try common payload shapes
    if r.status_code != 200:
        r = _post("/track", {"pnr": pnr})
    assert r.status_code == 200, f"track failed: {r.status_code} {r.text}"
    body = r.json()
    # /track returns a list of matching bookings
    if isinstance(body, list):
        assert any(b.get("pnr") == pnr for b in body), f"PNR {pnr} not in track results"
    else:
        assert body.get("pnr") == pnr or body.get("booking", {}).get("pnr") == pnr


def test_refund_flow(fresh_customer, booking):
    r = _post("/refunds", {"booking_id": booking["id"], "reason": "Customer requested"},
              token=fresh_customer["token"])
    assert r.status_code == 200, f"refund failed: {r.status_code} {r.text}"
    body = r.json()
    rid = body.get("refund_id") or body.get("id") or ""
    assert rid.startswith("RFD"), f"refund id should start with RFD, got {rid}"

    mine = _get("/refunds/mine", token=fresh_customer["token"])
    assert mine.status_code == 200
    items = mine.json()
    ids = [x.get("refund_id") or x.get("id") for x in items]
    assert rid in ids


# ===================================================================
# Admin
# ===================================================================
def test_admin_dashboard(admin_token):
    r = _get("/admin/dashboard", token=admin_token)
    assert r.status_code == 200, f"admin dashboard: {r.status_code} {r.text}"
    body = r.json()
    for k in ["revenue", "bookings", "customers", "top_routes"]:
        assert k in body, f"missing key: {k}"


def test_admin_email_logs(admin_token):
    r = _get("/admin/email-logs", token=admin_token)
    assert r.status_code == 200
    logs = r.json()
    assert isinstance(logs, list)
    assert len(logs) >= 1
    cats = {(l.get("category") or "").lower() for l in logs}
    statuses = {(l.get("status") or "").lower() for l in logs}
    assert "mocked" in statuses, f"expected status=mocked, got {statuses}"
    # welcome + booking_confirmation should be present
    assert any("welcome" in c for c in cats) or any("welcome" in (l.get("subject", "") or "").lower() for l in logs)
    assert any("booking" in c for c in cats) or any("booking" in (l.get("subject", "") or "").lower() for l in logs)


# ===================================================================
# Pilot / Crew
# ===================================================================
def test_pilot_flights(pilot_token):
    r = _get("/pilot/flights", token=pilot_token)
    assert r.status_code == 200, f"pilot flights: {r.status_code} {r.text}"
    body = r.json()
    # Endpoint returns {"pilot": ..., "flights": [...]}
    flights = body.get("flights") if isinstance(body, dict) else body
    assert isinstance(flights, list)


def test_crew_flights_and_manifest(crew_token):
    r = _get("/crew/flights", token=crew_token)
    assert r.status_code == 200, f"crew flights: {r.status_code} {r.text}"
    body = r.json()
    flights = body.get("flights") if isinstance(body, dict) else body
    assert isinstance(flights, list)
    if flights:
        fid = flights[0].get("id") or flights[0].get("flight_id")
        if fid:
            m = _get(f"/crew/manifest/{fid}", token=crew_token)
            assert m.status_code == 200
            mbody = m.json()
            assert "passengers" in mbody or isinstance(mbody, list)
