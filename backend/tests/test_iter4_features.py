"""
AeroVista Iteration 4 backend regression.
Covers: past-date search filter, concessions (medical/armed), corporate 5%,
reviews, careers, admin charts, financial records (list/import/export),
pilot cabin crew roster, phone+email login regression.
"""
import os
import base64
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@aerovista.com", "password": "Admin@123"}
PILOT = {"email": "pilot@aerovista.com", "password": "Pilot@123"}
CREW = {"email": "crew@aerovista.com", "password": "Crew@123"}
CUSTOMER = {"email": "customer@aerovista.com", "password": "Customer@123"}


def _post(p, j=None, t=None):
    h = {"Content-Type": "application/json"}
    if t:
        h["Authorization"] = f"Bearer {t}"
    return requests.post(f"{API}{p}", json=j, headers=h, timeout=60)


def _get(p, t=None, **kw):
    h = {}
    if t:
        h["Authorization"] = f"Bearer {t}"
    return requests.get(f"{API}{p}", headers=h, timeout=60, **kw)


# ------------------ Fixtures ------------------
@pytest.fixture(scope="session")
def admin_token():
    r = _post("/auth/login", ADMIN)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def customer_token():
    r = _post("/auth/login", CUSTOMER)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def pilot_token():
    r = _post("/auth/login", PILOT)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def future_flight(customer_token):
    """Pick a flight ~7 days out so it's clearly future."""
    dep = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")
    r = _post("/flights/search", {
        "origin": "DEL", "destination": "BOM", "departure_date": dep,
        "trip_type": "one_way", "passengers": 1, "cabin_class": "economy",
    })
    assert r.status_code == 200, r.text
    outbound = r.json().get("outbound") or []
    assert len(outbound) >= 3, f"expected >=3 future flights, got {len(outbound)}"
    return outbound[0]


# ------------------ 1. Search past/future ------------------
def test_search_past_date_returns_empty():
    past = (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%d")
    r = _post("/flights/search", {
        "origin": "DEL", "destination": "BOM", "departure_date": past,
        "trip_type": "one_way", "passengers": 1, "cabin_class": "economy",
    })
    assert r.status_code == 200
    outbound = r.json().get("outbound") or []
    assert outbound == [], f"past date returned {len(outbound)} flights"


def test_search_tomorrow_returns_future_flights(future_flight):
    # future_flight fixture already asserts >=3
    assert future_flight.get("id")


# ------------------ 2. Booking concessions ------------------
def _billing(email, corporate=None):
    b = {
        "contact_name": "E2E Tester",
        "contact_email": email,
        "contact_mobile": "+919000000000",
        "address_line1": "1 Test Street",
        "city": "Delhi", "state": "DL", "postal_code": "110001",
        "country": "India",
    }
    if corporate:
        b["corporate"] = corporate
    return b


def _book(flight, customer_token, passengers, billing):
    payload = {
        "flight_id": flight["id"],
        "cabin_class": "economy",
        "passengers": passengers,
        "seat_numbers": [],
        "meal_preferences": ["standard"] * len(passengers),
        "add_baggage": False,
        "add_insurance": False,
        "billing": billing,
        "promo_code": "",
    }
    return _post("/bookings", payload, t=customer_token)


def test_booking_no_concession(future_flight, customer_token):
    pax = [{"title": "Mr", "first_name": "Plain", "last_name": "Pax", "gender": "M", "nationality": "Indian"}]
    r = _book(future_flight, customer_token, pax, _billing(CUSTOMER["email"]))
    assert r.status_code == 200, r.text
    bk = r.json()
    fare = bk["fare"]
    assert fare.get("concession", 0) == 0, f"expected 0 concession, got {fare.get('concession')}"
    # discount should be only promo (none here = 0)
    assert fare.get("discount", 0) == 0, f"expected 0 discount, got {fare.get('discount')}"


def test_booking_with_medical_and_armed_concession(future_flight, customer_token):
    pax = [
        {"title": "Mr", "first_name": "Doc", "last_name": "Med", "gender": "M",
         "nationality": "Indian", "is_medical": True, "medical_id": "MED-12345"},
        {"title": "Mr", "first_name": "Soldier", "last_name": "Arm", "gender": "M",
         "nationality": "Indian", "is_armed_forces": True, "service_id": "ARMY-67890"},
    ]
    r = _book(future_flight, customer_token, pax, _billing(CUSTOMER["email"]))
    assert r.status_code == 200, r.text
    bk = r.json()
    fare = bk["fare"]
    base = fare.get("base", 0)
    # 20% per pax * 2 pax = 40% of (base_per_pax * 2)
    expected = round(base * 0.20, 2)
    actual = fare.get("concession", 0)
    # tolerance of 2 rupees for rounding across passengers
    assert abs(actual - expected) <= 2.0, f"concession expected ~{expected} got {actual} (base={base})"
    assert actual > 0


def test_booking_with_corporate_5pct(future_flight, customer_token):
    pax = [{"title": "Mr", "first_name": "Corp", "last_name": "Trav", "gender": "M", "nationality": "Indian"}]
    corp = {"company_name": "ACME PVT LTD", "gstin": "27AAACA1234B1Z5",
            "po_number": "PO-001", "invoice_email": "billing@acme.test"}
    r = _book(future_flight, customer_token, pax, _billing(CUSTOMER["email"], corporate=corp))
    assert r.status_code == 200, r.text
    fare = r.json()["fare"]
    base = fare.get("base", 0)
    expected_corp = round(base * 0.05, 2)
    actual_disc = fare.get("discount", 0)
    # discount = promo(0) + corporate 5%
    assert abs(actual_disc - expected_corp) <= 2.0, \
        f"corporate discount expected ~{expected_corp} got {actual_disc} (base={base})"


def test_booking_past_flight_rejected(admin_token, customer_token):
    """Try a past-flight booking. If seed won't allow, we mark XFAIL."""
    # find any flight, then attempt to manipulate via direct flight id
    # We can't easily set departure_iso to past via API. Try a flight from /flights search but using past date
    # — already covered by empty list test. So we look up admin/flights to find any.
    r = _get("/admin/dashboard", t=admin_token)
    assert r.status_code == 200
    # Attempt with a known-future flight but pretend it's past — not feasible.
    # Per spec we may skip if no past flight exists.
    pytest.skip("No past flight exists in seed; cannot reproduce 400 'already departed' without DB manipulation")


# ------------------ 3. Reviews ------------------
def test_reviews_submit_and_list():
    payload = {
        "name": "Test Reviewer",
        "email": "review-test@aerovista.test",
        "rating": 5,
        "title": "Iter4 review",
        "comment": "Automated test review for iteration 4.",
    }
    r = _post("/reviews", payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("id") or body.get("review_id") or body.get("ok")

    g = _get("/reviews")
    assert g.status_code == 200
    items = g.json()
    assert isinstance(items, list)
    assert any(it.get("title") == "Iter4 review" for it in items), "review not in list"


def test_admin_email_logs_review(admin_token):
    r = _get("/admin/email-logs", t=admin_token)
    assert r.status_code == 200
    cats = {(l.get("category") or "").lower() for l in r.json()}
    # we expect at least one review-related category
    assert any("review" in c for c in cats), f"no review email categories; got {cats}"


# ------------------ 4. Careers ------------------
def test_careers_apply_ok():
    payload = {
        "name": "Test Applicant",
        "email": "applicant@aerovista.test",
        "phone": "+919000099999",
        "position": "Cabin Crew",
        "cover_letter": "I love flying.",
    }
    r = _post("/careers/apply", payload)
    assert r.status_code == 200, r.text


def test_careers_apply_resume_too_large():
    # > 5 MB base64 payload
    big = base64.b64encode(b"A" * (6 * 1024 * 1024)).decode("ascii")
    payload = {
        "name": "Big Resume",
        "email": "big@aerovista.test",
        "phone": "+910000000000",
        "position": "Pilot",
        "cover_letter": "x",
        "resume_base64": big,
        "resume_filename": "big.pdf",
    }
    r = _post("/careers/apply", payload)
    assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text[:200]}"


def test_admin_career_applications(admin_token):
    r = _get("/admin/career-applications", t=admin_token)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert any(it.get("email") == "applicant@aerovista.test" for it in items)


# ------------------ 5. Admin charts ------------------
def test_admin_charts_traffic(admin_token):
    r = _get("/admin/charts/traffic", t=admin_token, params={"days": 30})
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 30, f"expected >=30 daily entries got {len(data)}"
    for d in data[:3]:
        for k in ("page_views", "unique_visitors", "sessions"):
            assert k in d, f"missing {k} in {d}"


def test_track_event_bumps_traffic(admin_token):
    before = _get("/admin/charts/traffic", t=admin_token, params={"days": 1}).json()
    pv_before = (before[-1]["page_views"] if before else 0)
    e = _post("/track/event", {"path": "/test", "type": "pageview"})
    assert e.status_code == 200, e.text
    after = _get("/admin/charts/traffic", t=admin_token, params={"days": 1}).json()
    pv_after = (after[-1]["page_views"] if after else 0)
    assert pv_after >= pv_before + 1, f"page_views did not increment ({pv_before} -> {pv_after})"


def test_admin_charts_user_growth_monotonic(admin_token):
    r = _get("/admin/charts/user-growth", t=admin_token, params={"days": 30})
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list) and len(data) >= 1
    # find users key
    series = [d.get("users", d.get("cumulative", 0)) for d in data]
    for i in range(1, len(series)):
        assert series[i] >= series[i - 1], f"users not monotonically non-decreasing at idx {i}: {series}"


def test_admin_charts_seasons(admin_token):
    r = _get("/admin/charts/seasons", t=admin_token)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list) and len(data) == 3, f"expected 3 seasons, got {len(data)}"
    names = {(d.get("name") or d.get("label") or "").lower() for d in data}
    assert any("peak" in n for n in names)
    assert any("mid" in n for n in names)
    assert any("off" in n for n in names)
    for d in data:
        rev = d.get("revenue", 0)
        assert rev > 0, f"non-positive revenue for {d}"


def test_admin_charts_festivals(admin_token):
    r = _get("/admin/charts/festivals", t=admin_token)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list) and len(data) >= 5
    names = " ".join((d.get("name") or "").lower() for d in data)
    for expected in ("diwali", "christmas", "holi", "summer", "eid"):
        assert expected in names, f"missing festival '{expected}' in {names}"


# ------------------ 6. Financial records ------------------
def test_admin_financial_records_list_20(admin_token):
    r = _get("/admin/financial-records", t=admin_token)
    assert r.status_code == 200, r.text
    items = r.json()
    assert isinstance(items, list)
    assert len(items) == 20, f"expected 20 financial records, got {len(items)}"


def test_admin_exports_financials_csv_xlsx(admin_token):
    for ext, expected_ctype in (("csv", "csv"), ("xlsx", "spreadsheet")):
        r = _get(f"/admin/exports/financials.{ext}", t=admin_token)
        assert r.status_code == 200, f"{ext}: {r.status_code} {r.text[:200]}"
        cd = r.headers.get("content-disposition", "").lower()
        assert "attachment" in cd or "filename" in cd, f"{ext} missing Content-Disposition: {cd}"
        assert len(r.content) > 100, f"{ext} body too small ({len(r.content)} bytes)"


def test_admin_financial_records_import_upsert(admin_token):
    # 1 existing-like + 2 new rows. Use 2025-09 / 2026-02 months that exist in seed.
    existing_month = "2025-09"
    rows = [
        {"month": existing_month, "route": "DEL-BOM", "kind": "revenue", "amount": 99999.0, "currency": "INR"},
        {"month": "2099-01", "route": "TEST-NEW1", "kind": "revenue", "amount": 12345.0, "currency": "INR"},
        {"month": "2099-02", "route": "TEST-NEW2", "kind": "cost", "amount": 6789.0, "currency": "INR"},
    ]
    r = _post("/admin/financial-records/import", {"rows": rows}, t=admin_token)
    assert r.status_code == 200, r.text
    body = r.json()
    # accept any sensible response
    assert any(k in body for k in ("inserted", "upserted", "ok", "count"))

    # Verify list now contains new rows
    items = _get("/admin/financial-records", t=admin_token).json()
    routes = {it.get("route") for it in items}
    assert "TEST-NEW1" in routes and "TEST-NEW2" in routes, f"new rows missing; routes={routes}"


# ------------------ 7. Pilot dashboard ------------------
def test_pilot_flights_with_crew_roster(pilot_token):
    r = _get("/pilot/flights", t=pilot_token)
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body, dict)
    assert "pilot" in body and "flights" in body
    roster = body.get("cabin_crew_roster") or body.get("crew_roster") or []
    assert isinstance(roster, list)
    assert len(roster) == 20, f"expected 20 crew roster, got {len(roster)}"
    names = [c.get("name") for c in roster]
    assert len(set(names)) == 20, f"crew names not unique: {names}"

    flights = body.get("flights") or []
    if flights:
        f0 = flights[0]
        crew_arr = f0.get("crew") or []
        assert isinstance(crew_arr, list)
        if crew_arr:
            c0 = crew_arr[0]
            for k in ("name", "role", "employee_id"):
                assert k in c0, f"flight.crew[0] missing {k}; got keys {list(c0.keys())}"


# ------------------ 8. Phone + email login regression ------------------
@pytest.mark.parametrize("role,creds,mobile_suffix", [
    ("admin", ADMIN, "9000000001"),
    ("pilot", PILOT, "9000000002"),
    ("crew", CREW, "9000000003"),
    ("customer", CUSTOMER, "9000000004"),
])
def test_login_email_and_mobile(role, creds, mobile_suffix):
    r1 = _post("/auth/login", creds)
    assert r1.status_code == 200, f"{role} email login failed: {r1.text}"
    assert r1.json()["user"]["role"] == role

    r2 = _post("/auth/login", {"mobile": f"+91 {mobile_suffix}", "password": creds["password"]})
    assert r2.status_code == 200, f"{role} mobile login failed: {r2.text}"
    assert r2.json()["user"]["role"] == role
