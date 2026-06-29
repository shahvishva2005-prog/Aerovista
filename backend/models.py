from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime, timezone
import uuid


def gen_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ===== Auth =====
class RegisterReq(BaseModel):
    name: str
    email: EmailStr
    password: str
    mobile: Optional[str] = None


class LoginReq(BaseModel):
    email: Optional[str] = None  # Email OR mobile — at least one required
    mobile: Optional[str] = None
    password: str


class TokenRes(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ===== Flight Search / Booking =====
class FlightSearchReq(BaseModel):
    origin: str  # IATA
    destination: str  # IATA
    departure_date: str  # YYYY-MM-DD
    return_date: Optional[str] = None
    trip_type: Literal["one_way", "round_trip"] = "one_way"
    passengers: int = 1
    cabin_class: Literal["economy", "premium_economy", "business", "first"] = "economy"


class PassengerInfo(BaseModel):
    title: Literal["Mr", "Mrs", "Ms", "Mstr"] = "Mr"
    first_name: str
    last_name: str
    dob: Optional[str] = None
    gender: Literal["M", "F", "O"] = "M"
    nationality: Optional[str] = "Indian"
    passport_no: Optional[str] = None
    is_senior: bool = False
    is_disabled: bool = False
    is_child: bool = False
    is_infant: bool = False


class BillingInfo(BaseModel):
    contact_name: str
    contact_email: EmailStr
    contact_mobile: str
    address_line1: str
    address_line2: Optional[str] = ""
    city: str
    state: str
    postal_code: str
    country: str = "India"
    gst_number: Optional[str] = ""


class CreateBookingReq(BaseModel):
    flight_id: str
    cabin_class: str = "economy"
    passengers: List[PassengerInfo]
    seat_numbers: List[str] = []
    meal_preferences: List[str] = []
    add_baggage: bool = False
    add_insurance: bool = False
    billing: BillingInfo
    promo_code: Optional[str] = ""


class PaymentReq(BaseModel):
    booking_id: str
    method: Literal["credit_card", "debit_card", "upi", "wallet", "net_banking"]
    card_holder: Optional[str] = None
    card_number_last4: Optional[str] = None
    bank: Optional[str] = None  # HDFC, ICICI, AXIS, SBI
    upi_id: Optional[str] = None


class RefundReq(BaseModel):
    booking_id: str
    reason: str = "Customer requested"


class RescheduleReq(BaseModel):
    booking_id: str
    new_flight_id: str


class CheckInReq(BaseModel):
    pnr: str
    last_name: str


class TrackReq(BaseModel):
    pnr: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None


class ForgotPwdReq(BaseModel):
    email: EmailStr


class ResetPwdReq(BaseModel):
    token: str
    new_password: str
