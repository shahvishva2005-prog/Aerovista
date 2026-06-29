"""AeroVista Airlines - FastAPI Core Backend Engine with Real-Time Coordinate Metrics.
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
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# 🌟 APPLICATION CORNERSTONE INITIALIZATION
app = FastAPI(title="AeroVista Airlines API")

# 🔒 SECURITY ENGINE MIDDLEWARE (Configured to avoid browser preflight wildcard conflicts)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=False,  # Unblocks wildcard patterns over standard HTTP tokens securely
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🛠️ GLOBAL EXCEPTION HANDLER FOR CORS INSTABILITY IMMUNITY
@app.exception_handler(HTTPException)
async def cors_error_protection_handler(request, exc):
    """Guarantees that security headers return to the browser even during auth or structural drops."""
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "success": False}
    )
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# 🚀 EXPLICIT PREFLIGHT ROUTE OVERRIDE ABSORBER
@app.options("/{rest_of_path:path}")
async def dynamic_preflight_override(rest_of_path: str):
    """Intercepts browser OPTIONS handshakes before dependencies can cause a pipeline crash."""
    response = JSONResponse(status_code=200, content={"status": "preflight_acknowledged"})
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# 🛠️ BASE LINE ROUTER
api = APIRouter()

# Background scheduler — runs pre-departure upsell scan hourly
from apscheduler.schedulers.asyncio import AsyncIOScheduler
scheduler = AsyncIOScheduler()

# ===== Helpers =====
PROJECT_NO_ID = {"_id": 0}


def _
