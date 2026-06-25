# AeroVista Airlines — Product Requirements (Living Doc)

## Problem Statement (original)
Build a production-quality full-stack airline management platform called **AeroVista Airlines** with the tagline "Connecting Horizons, Delivering Excellence" — a complete airline ecosystem comparable to Emirates, Qatar Airways, Singapore Airlines, Indigo, Etihad. Must include: public website, authentication (customer/admin/pilot/crew), full booking flow with seat selection + billing + dummy payment, PDF tickets/boarding passes/invoices/receipts, refund and reschedule, web check-in, PNR tracking, admin analytics, pilot/crew portals, email system with templates, 200+ airports, dynamic pricing.

## Architecture
- Backend: FastAPI + Motor (MongoDB) + JWT
- Frontend: React (CRA) + Tailwind + Framer Motion + Recharts + Sonner
- PDFs: ReportLab + qrcode
- Email: smtplib (MOCKED unless SMTP_PASSWORD set in .env)

## Implemented (2026-02)
- 200+ global airports (data/airports.py)
- Auth: register/login/me with JWT roles (customer, admin, pilot, crew)
- Seeded: 4 users, 15 aircraft, 10 pilots, 10 crew, ~1,800 flights
- Public pages: Home (luxury hero, stats, destinations bento grid, offers, fleet, why-us, testimonials, mobile-app), Flight Search, Track, Web Check-in, Offers, Destinations, Fleet, About, Contact, Careers
- Auth pages: Login, Register
- Booking flow: Search → Seat selection (interactive aircraft map) → Billing (passenger + GST + meals + add-ons + promo) → Payment (CC/Debit/UPI/Wallet/Net Banking with bank offers) → Confirmation with light-themed boarding pass card
- Dynamic pricing engine with reasons (weekend, last-minute, festival, low seats)
- PDF generation: e-ticket, boarding pass (landscape with perforated stub + QR), tax invoice, payment receipt
- Customer Dashboard: SkyChip tier progress, upcoming/past/cancelled bookings, refunds, PDF downloads, cancel→refund flow
- Admin Dashboard: revenue chart, top routes, bookings, refunds with status updates, email logs
- Pilot Dashboard: assigned flights
- Crew Dashboard: per-flight passenger manifest with seat/meal/special-care flags
- Email templates + DB logging (welcome, booking confirmation w/ attachments, ticket, invoice, receipt, boarding, reminders, cancellation, refund, reschedule)
- Refund system with auto IDs (RFD000001 format) + status workflow
- Reschedule with fare difference + history
- Promo codes: HDFC10, ICICI200, AXIS5, SBI500

## Backlog (P1/P2)
- Real SMTP integration once Gmail App Password is provided
- Interactive world map for global route network
- Advanced analytics (occupancy trends, cancellation trends, finance module: incoming/outgoing funds)
- CSV/Excel exports for admin
- Pilot/Crew leave requests, attendance, announcements
- Operations Control Center live status board
- Mobile app pages (PWA)
- Customer push notifications
- Forgot/reset password flow
- Multi-city itinerary
- Real PDF barcode (currently QR only)

## Next Action Items
1. Run testing agent (backend + frontend smoke)
2. Address any blocking issues
3. Add CSV/Excel export endpoints
4. Polish: forgot password, world map
