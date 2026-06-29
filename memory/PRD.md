# AeroVista Airlines — Product Requirements (Living Doc)

## Problem Statement (original)
Build a production-quality full-stack airline management platform called **AeroVista Airlines** with the tagline "Connecting Horizons, Delivering Excellence" — a complete airline ecosystem comparable to Emirates, Qatar Airways, Singapore Airlines, Indigo, Etihad. Must include: public website, authentication (customer/admin/pilot/crew), full booking flow with seat selection + billing + dummy payment, PDF tickets/boarding passes/invoices/receipts, refund and reschedule, web check-in, PNR tracking, admin analytics, pilot/crew portals, email system with templates, 200+ airports, dynamic pricing.

## Architecture
- Backend: FastAPI + Motor (MongoDB) + JWT, APScheduler hourly upsell scanner
- Frontend: React (CRA) + Tailwind + Framer Motion + Recharts + Sonner
- PDFs: ReportLab + qrcode
- Email: smtplib LIVE via Gmail SMTP `airlinesaerovista@gmail.com` (EMAIL_ENABLED=true)
- Deployment target: Render (backend) + Cloudflare Pages (frontend) + MongoDB Atlas — see `/app/DEPLOY.md`

## Implemented

### Phase 1 — MVP (2026-02)
- 200+ global airports, full booking funnel, PDFs (e-ticket / boarding pass / invoice / receipt), refunds, reschedule, customer/admin/pilot/crew dashboards, dynamic pricing.

### Phase 2 — Polish (2026-02 → 2026-06)
- Forgot/reset password with security gate
- Real SMTP (App Password) — welcome / confirmation / reset / pre-departure upsell
- APScheduler hourly upsell scan (36h pre-departure)
- Admin CSV/Excel exports (bookings, payments, customers, refunds, flights, revenue)
- Light-luxury UI with blue navy header + golden plane logo
- Phone-number login (email or +91 mobile) with last-10-digit suffix match
- Real-time flight time / arrival countdowns on Track page
- Custom flight seeder: 3–5 domestic per route + 3 direct + 5 layover for international, with DXB/AUH hubs
- Customer cancellation pop-up with refund preview (85% refund, 15% fee)
- Admin charts: bookings-trend, cabin-split, occupancy
- Test coverage: iteration 3 → 21 auth + 6 frontend tests, all green

### Phase 3 — Big Feature Batch (2026-06)
- Booking pages now use cream background (`#F5EFE3` via `av-bg-booking`)
- Multi-city option removed from flight search (only One Way + Round Trip)
- Real-time guard: past flights hidden from search; booking past flights rejected with 400
- **Concession 20%**: medical personnel (medical_id) + armed forces (service_id), per-passenger flags
- **Corporate booking**: 5% discount when company_name + GSTIN provided in `billing.corporate`
- **Compulsory payment fields**: card holder, number, expiry (MM/YY, expired-card check), CVV, billing ZIP — frontend validate() + backend PaymentReq
- Pilot portal: 20 dummy pilots roster + 20 cabin crew assigned per flight (hydrated names/roles); Cabin Crew Roster tab
- **Admin charts added**: Website Traffic (AreaChart), User Growth (cumulative), Seasonal Revenue (Peak/Mid/Off), Festival Calendar (Diwali, Christmas, Holi, Summer, Eid)
- **Financial records**: 20 hardcoded route-P&L rows seeded (2025-09 → 2026-02) with revenue/refunds/margin/season; full CSV + Excel export + **CSV import (upsert)**
- **Reviews system** at `/reviews`: 1–5 stars, in-app form, emails airlinesaerovista@gmail.com on every submission + thank-you to reviewer
- **Careers application** at `/careers`: modal with resume upload (PDF/Word ≤ 5MB), emails airlinesaerovista@gmail.com with attached resume + ack to applicant
- Refund-status deep-link from footer to `/account?tab=refunds`
- Traffic pixel `/api/track/event` fires on every route change and feeds the admin Traffic chart
- Deployment guide `/app/DEPLOY.md` for Render + Cloudflare + Mongo Atlas

## Iteration Test Status
- iter 1 (MVP) — green
- iter 2 (force-seed bug + forgot-password) — green
- iter 3 (phone login + email regression) — **21/21 backend + 6/6 frontend pass**
- iter 4 (concessions, corporate, charts, reviews, careers, CSV import, dummy data) — **23/23 backend pass + 1 documented skip**

## Backlog (P1)
- Multi-city itinerary (deliberately removed in iter 4 per user request — re-add if asked)
- SkyChip Loyalty earn/redeem flow with redemption catalogue
- Operations Control Center live status board for admin/crew
- Interactive seat map integration for already-confirmed bookings (currently only at booking time)
- Stripe / Razorpay dummy payment integration

## Backlog (P2)
- Refactor: split `server.py` (~1380 lines) into `routes/{auth,bookings,flights,admin,careers,reviews}.py`
- Pilot/Crew leave requests + announcements module
- Customer push notifications (web push)
- True barcode on boarding pass (currently QR only)
- Replace suffix-regex mobile login with normalized `mobile_digits` field for indexing at scale

## Next Action Items
1. (Optional) Frontend Playwright smoke pass on the 7 iter-4 UI flows
2. SkyChip Loyalty earn/redeem MVP
3. Operations Control Center live board
4. Payment gateway dummy integration (Stripe/Razorpay)
