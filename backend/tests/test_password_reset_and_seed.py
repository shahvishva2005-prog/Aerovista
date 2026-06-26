"""
AeroVista — Bug-fix verification tests (iteration 2).
Covers:
  1. force-seed preserves real customers (only deletes the 4 demo accounts)
  2. forgot-password for existing user -> email_logs (category=password_reset, status=sent)
  3. forgot-password for non-existent user -> email_logs (category=password_reset_no_user, status=skipped)
  4. admin generate reset link -> returns reset_link; token works in /auth/reset-password
  5. live SMTP path: email_logs status='sent' (or at least not 'mocked') with empty error_message
"""

import os
import random
import string
import time

import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://sky-booking-hub-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@aerovista.com", "password": "Admin@123"}
CUSTOMER = {"email": "customer@aerovista.com", "password": "Customer@123"}


def _rand(n=8):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def _post(path, json=None, token=None, timeout=60):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.post(f"{API}{path}", json=json, headers=h, timeout=timeout)


def _get(path, token=None, params=None, timeout=60):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.get(f"{API}{path}", headers=h, params=params, timeout=timeout)


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    # Make sure base seed exists so admin login works.
    _post("/admin/seed")
    r = _post("/auth/login", ADMIN)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


# =====================================================================
# 1. force-seed preserves real customers
# =====================================================================
def test_force_seed_preserves_real_customer():
    email = f"preserve-test-{_rand()}@example.com"
    password = "Preserve@123"

    # a) register fresh customer
    reg = _post("/auth/register", {
        "name": "Preserve Test", "email": email,
        "password": password, "mobile": "+919000000099",
    })
    assert reg.status_code == 200, f"register failed: {reg.status_code} {reg.text}"

    # b) force-seed
    fs = _post("/admin/seed")  # ensure system seeded once
    assert fs.status_code == 200
    force = requests.post(f"{API}/admin/seed", params={"force": "true"}, timeout=120)
    assert force.status_code == 200, f"force seed failed: {force.status_code} {force.text}"

    # c) login with same credentials must STILL work
    li = _post("/auth/login", {"email": email, "password": password})
    assert li.status_code == 200, (
        f"Real customer was wiped by force-seed! login -> {li.status_code} {li.text}"
    )
    assert li.json()["user"]["email"] == email


# =====================================================================
# 2. forgot-password for existing user
# =====================================================================
def test_forgot_password_existing_user_logs_sent(admin_token):
    r = _post("/auth/forgot-password", {"email": CUSTOMER["email"]})
    assert r.status_code == 200, f"forgot-pwd failed: {r.status_code} {r.text}"
    body = r.json()
    assert "spam" in (body.get("message") or "").lower(), (
        f"expected anti-spam guidance in message, got: {body}"
    )

    # SMTP send takes a moment
    time.sleep(2)

    logs = _get("/admin/email-logs", token=admin_token).json()
    assert isinstance(logs, list) and logs, "no email logs returned"

    pr_logs = [
        l for l in logs
        if (l.get("category") or "").lower() == "password_reset"
        and (l.get("to_email") or "").lower() == CUSTOMER["email"]
    ]
    assert pr_logs, f"no password_reset log for {CUSTOMER['email']}; sample={logs[:3]}"
    latest = pr_logs[0]  # logs are sorted desc by created_at
    assert (latest.get("status") or "").lower() == "sent", (
        f"expected status=sent, got {latest.get('status')} err={latest.get('error_message')}"
    )
    assert not latest.get("error_message"), f"unexpected error: {latest.get('error_message')}"


# =====================================================================
# 3. forgot-password for non-existent user -> skipped log
# =====================================================================
def test_forgot_password_ghost_user_logs_skipped(admin_token):
    ghost = f"ghost-user-{_rand()}@example.com"
    r = _post("/auth/forgot-password", {"email": ghost})
    assert r.status_code == 200, f"forgot-pwd (ghost) failed: {r.status_code} {r.text}"

    time.sleep(1)
    logs = _get("/admin/email-logs", token=admin_token).json()
    matches = [
        l for l in logs
        if (l.get("to_email") or "").lower() == ghost
    ]
    assert matches, f"expected a log row for ghost user {ghost}"
    g = matches[0]
    assert (g.get("category") or "").lower() == "password_reset_no_user", g
    assert (g.get("status") or "").lower() == "skipped", g


# =====================================================================
# 4. admin generate reset link -> token works
# =====================================================================
def test_admin_generate_reset_link_and_reset_password(admin_token):
    # generate
    r = _post("/admin/password-reset-link",
              {"email": CUSTOMER["email"]}, token=admin_token)
    assert r.status_code == 200, f"admin reset-link failed: {r.status_code} {r.text}"
    body = r.json()
    assert "reset_link" in body and "reset-password?token=" in body["reset_link"], body
    assert body.get("user") == CUSTOMER["email"]
    assert body.get("name")
    assert isinstance(body.get("expires_minutes"), int)

    token = body["reset_link"].split("token=", 1)[1]
    new_pwd = "NewPass@123"

    # apply reset
    rp = _post("/auth/reset-password", {"token": token, "new_password": new_pwd})
    assert rp.status_code == 200, f"reset-password failed: {rp.status_code} {rp.text}"

    # login with NEW password works
    li_new = _post("/auth/login", {"email": CUSTOMER["email"], "password": new_pwd})
    assert li_new.status_code == 200, f"login with new pwd failed: {li_new.text}"

    # login with OLD password fails
    li_old = _post("/auth/login", CUSTOMER)
    assert li_old.status_code in (400, 401), (
        f"old password should be rejected, got {li_old.status_code} {li_old.text}"
    )

    # ---- RESTORE original password for future iterations ----
    r2 = _post("/admin/password-reset-link",
               {"email": CUSTOMER["email"]}, token=admin_token)
    assert r2.status_code == 200
    token2 = r2.json()["reset_link"].split("token=", 1)[1]
    rp2 = _post("/auth/reset-password",
                {"token": token2, "new_password": CUSTOMER["password"]})
    assert rp2.status_code == 200, "FAILED to restore Customer@123; please restore manually"

    # confirm restore
    li_restore = _post("/auth/login", CUSTOMER)
    assert li_restore.status_code == 200, "customer creds NOT restored after test!"
