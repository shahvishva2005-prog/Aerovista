"""Auth regression: email login + new phone-number login support.

Tests POST /api/auth/login for all seeded roles via email + mobile (exact and
digits-only). Also verifies error paths and /api/auth/me using both flows.
"""
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ROLES = [
    ("admin",    "admin@aerovista.com",    "Admin@123",    "+91 9000000001", "9000000001", "/admin"),
    ("pilot",    "pilot@aerovista.com",    "Pilot@123",    "+91 9000000002", "9000000002", "/pilot"),
    ("crew",     "crew@aerovista.com",     "Crew@123",     "+91 9000000003", "9000000003", "/crew"),
    ("customer", "customer@aerovista.com", "Customer@123", "+91 9000000004", "9000000004", "/account"),
]


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Email login regression for every seeded role ---
@pytest.mark.parametrize("role,email,pw,mobile_full,mobile_digits,redirect", ROLES)
def test_email_login_works(session, role, email, pw, mobile_full, mobile_digits, redirect):
    r = session.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data and isinstance(data["access_token"], str) and len(data["access_token"]) > 20
    assert data["user"]["email"] == email
    assert data["user"]["role"] == role
    assert "password_hash" not in data["user"]
    assert "_id" not in data["user"]


# --- Mobile login: exact stored format ---
@pytest.mark.parametrize("role,email,pw,mobile_full,mobile_digits,redirect", ROLES)
def test_mobile_login_exact(session, role, email, pw, mobile_full, mobile_digits, redirect):
    r = session.post(f"{API}/auth/login", json={"mobile": mobile_full, "password": pw})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["email"] == email
    assert data["user"]["role"] == role


# --- Mobile login: digits-only suffix lookup ---
@pytest.mark.parametrize("role,email,pw,mobile_full,mobile_digits,redirect", ROLES)
def test_mobile_login_digits_only(session, role, email, pw, mobile_full, mobile_digits, redirect):
    r = session.post(f"{API}/auth/login", json={"mobile": mobile_digits, "password": pw})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["email"] == email


# --- Error paths ---
def test_invalid_mobile_too_short(session):
    r = session.post(f"{API}/auth/login", json={"mobile": "12345", "password": "anything"})
    assert r.status_code == 400
    body = r.json()
    assert "mobile" in (body.get("detail") or "").lower()


def test_wrong_password_email(session):
    r = session.post(f"{API}/auth/login", json={"email": "admin@aerovista.com", "password": "WRONG"})
    assert r.status_code == 401
    assert r.json().get("detail") == "Invalid credentials"


def test_wrong_password_mobile(session):
    r = session.post(f"{API}/auth/login", json={"mobile": "9000000001", "password": "WRONG"})
    assert r.status_code == 401
    assert r.json().get("detail") == "Invalid credentials"


def test_nonexistent_email(session):
    r = session.post(f"{API}/auth/login", json={"email": "nobody@aerovista.com", "password": "Admin@123"})
    assert r.status_code == 401


def test_nonexistent_mobile(session):
    r = session.post(f"{API}/auth/login", json={"mobile": "9999999999", "password": "Admin@123"})
    assert r.status_code == 401


def test_empty_identifier(session):
    r = session.post(f"{API}/auth/login", json={"password": "Admin@123"})
    # Either 400 (server message) or 422 (pydantic) is acceptable
    assert r.status_code in (400, 422)


# --- /api/auth/me using JWT from both flows ---
def test_me_with_email_login_token(session):
    r = session.post(f"{API}/auth/login", json={"email": "customer@aerovista.com", "password": "Customer@123"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == "customer@aerovista.com"
    assert body["role"] == "customer"
    assert "password_hash" not in body


def test_me_with_mobile_login_token(session):
    r = session.post(f"{API}/auth/login", json={"mobile": "9000000004", "password": "Customer@123"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "customer@aerovista.com"


def test_mobile_login_with_spaces_and_plus(session):
    # Variant: spaces stripped + plus prefix tolerated
    r = session.post(f"{API}/auth/login", json={"mobile": "  +91 9000000001  ", "password": "Admin@123"})
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "admin"
