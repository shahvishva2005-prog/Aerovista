"""PDF generation for AeroVista Airlines: tickets, boarding passes, invoices, receipts."""
import io
import os
import qrcode
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
)
from reportlab.pdfgen import canvas


NAVY = colors.HexColor("#0B132B")
MIDNIGHT = colors.HexColor("#1C2541")
GOLD = colors.HexColor("#D4AF37")
GOLD_LIGHT = colors.HexColor("#F3E5AB")
WHITE = colors.white
LIGHT_GRAY = colors.HexColor("#F5F5F5")
DARK_GRAY = colors.HexColor("#333333")


def _qr_image(data: str, size: int = 120) -> Image:
    qr = qrcode.QRCode(box_size=4, border=1)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return Image(buf, width=size, height=size)


def _draw_header(c: canvas.Canvas, width: float, y: float, subtitle: str = ""):
    c.setFillColor(NAVY)
    c.rect(0, y - 80, width, 80, stroke=0, fill=1)
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 26)
    c.drawString(20 * mm, y - 35, "AeroVista")
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 11)
    c.drawString(20 * mm, y - 55, "Connecting Horizons, Delivering Excellence")
    if subtitle:
        c.setFillColor(GOLD_LIGHT)
        c.setFont("Helvetica-Bold", 14)
        c.drawRightString(width - 20 * mm, y - 40, subtitle)


def generate_ticket_pdf(booking: dict, flight: dict, passengers: list) -> bytes:
    """Generate e-ticket PDF with passenger info, flight details, fare, QR code."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm,
    )
    styles = getSampleStyleSheet()
    label = ParagraphStyle("label", parent=styles["Normal"], fontName="Helvetica",
                           fontSize=8, textColor=colors.HexColor("#888888"), spaceAfter=2)
    value = ParagraphStyle("value", parent=styles["Normal"], fontName="Helvetica-Bold",
                           fontSize=12, textColor=NAVY, spaceAfter=4)
    title = ParagraphStyle("title", parent=styles["Heading1"], fontName="Helvetica-Bold",
                           fontSize=22, textColor=NAVY)
    gold_band = ParagraphStyle("gold", parent=styles["Normal"], fontName="Helvetica-Bold",
                               fontSize=11, textColor=GOLD)

    story = []

    # Banner header table
    banner = Table(
        [[Paragraph("<b>AeroVista Airlines</b><br/>"
                    "<font size=8 color='#cccccc'>Connecting Horizons, Delivering Excellence</font>",
                    ParagraphStyle("bn", fontName="Helvetica-Bold", fontSize=20, textColor=GOLD)),
          Paragraph("<para align='right'><font color='#F3E5AB' size=14>E-TICKET</font><br/>"
                    f"<font color='white' size=9>PNR: {booking.get('pnr','')}</font></para>",
                    styles["Normal"])]],
        colWidths=[110 * mm, 70 * mm],
    )
    banner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
    ]))
    story.append(banner)
    story.append(Spacer(1, 8))

    # Booking info row
    info = Table([
        [Paragraph("BOOKING REF (PNR)", label), Paragraph("TICKET NO", label), Paragraph("BOOKED ON", label)],
        [Paragraph(booking.get("pnr", ""), value),
         Paragraph(booking.get("ticket_number", ""), value),
         Paragraph(booking.get("booked_at", "")[:10], value)],
    ], colWidths=[60 * mm, 60 * mm, 60 * mm])
    info.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_GRAY),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(info)
    story.append(Spacer(1, 10))

    # Flight section
    story.append(Paragraph("FLIGHT DETAILS", gold_band))
    story.append(Spacer(1, 4))

    flight_table = Table([
        [Paragraph("FROM", label),
         Paragraph("", label),
         Paragraph("TO", label)],
        [Paragraph(f"<b>{flight.get('origin','')}</b><br/><font size=9>{flight.get('origin_city','')}</font>", value),
         Paragraph(f"<para align='center'><font color='#D4AF37' size=14>✈</font><br/>"
                   f"<font size=9>{flight.get('flight_number','')} • {flight.get('aircraft','')}</font></para>",
                   styles["Normal"]),
         Paragraph(f"<b>{flight.get('destination','')}</b><br/><font size=9>{flight.get('destination_city','')}</font>", value)],
        [Paragraph("DEPARTURE", label), Paragraph("DURATION", label), Paragraph("ARRIVAL", label)],
        [Paragraph(f"{flight.get('departure_time','')}<br/><font size=9>{flight.get('departure_date','')}</font>", value),
         Paragraph(f"<para align='center'>{flight.get('duration','')}</para>", styles["Normal"]),
         Paragraph(f"{flight.get('arrival_time','')}<br/><font size=9>{flight.get('arrival_date','')}</font>", value)],
        [Paragraph("TERMINAL", label), Paragraph("GATE", label), Paragraph("CLASS", label)],
        [Paragraph(flight.get("terminal", "T2"), value),
         Paragraph(flight.get("gate", "TBA"), value),
         Paragraph(booking.get("cabin_class", "Economy").title(), value)],
    ], colWidths=[60 * mm, 60 * mm, 60 * mm])
    flight_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#dddddd")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#eeeeee")),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(flight_table)
    story.append(Spacer(1, 12))

    # Passengers
    story.append(Paragraph("PASSENGERS", gold_band))
    story.append(Spacer(1, 4))
    pass_rows = [["#", "Name", "Seat", "Meal"]]
    for i, p in enumerate(passengers, 1):
        seat = booking.get("seats", [])[i - 1] if i - 1 < len(booking.get("seats", [])) else "TBA"
        meal = booking.get("meals", [])[i - 1] if i - 1 < len(booking.get("meals", [])) else "Standard"
        pass_rows.append([str(i), f"{p.get('title','')} {p.get('first_name','')} {p.get('last_name','')}", seat, meal])
    ptable = Table(pass_rows, colWidths=[15 * mm, 95 * mm, 35 * mm, 35 * mm])
    ptable.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#eeeeee")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(ptable)
    story.append(Spacer(1, 12))

    # Fare + QR side by side
    fare = booking.get("fare", {})
    fare_rows = [
        ["Base Fare", f"INR {fare.get('base', 0):.2f}"],
        ["Taxes & Fees", f"INR {fare.get('taxes', 0):.2f}"],
        ["Seat / Meals / Add-ons", f"INR {fare.get('addons', 0):.2f}"],
        ["Discount", f"- INR {fare.get('discount', 0):.2f}"],
        ["TOTAL", f"INR {fare.get('total', 0):.2f}"],
    ]
    fare_table = Table(fare_rows, colWidths=[55 * mm, 45 * mm])
    fare_table.setStyle(TableStyle([
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, -1), (-1, -1), GOLD),
        ("TEXTCOLOR", (0, -1), (-1, -1), NAVY),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#eeeeee")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))

    qr = _qr_image(f"PNR:{booking.get('pnr','')};TKT:{booking.get('ticket_number','')}", 100)
    bottom = Table([[fare_table, qr]], colWidths=[100 * mm, 80 * mm])
    bottom.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(bottom)
    story.append(Spacer(1, 14))

    story.append(Paragraph(
        "<font size=8 color='#888888'>"
        "Please arrive at the airport 2 hours before international and 1 hour before domestic departures. "
        "Carry a valid government-issued photo ID. Web check-in opens 24h before departure. "
        "AeroVista Airlines • Customer Care: airlinesaerovista@gmail.com</font>",
        styles["Normal"]
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()


def generate_boarding_pass_pdf(booking: dict, flight: dict, passenger: dict, seat: str) -> bytes:
    """Generate a horizontal boarding pass PDF with perforated stub."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=landscape(A4))
    W, H = landscape(A4)

    # Main panel (left)
    c.setFillColor(WHITE)
    c.rect(0, 0, W, H, fill=1, stroke=0)

    # Navy header strip
    c.setFillColor(NAVY)
    c.rect(0, H - 60, W, 60, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(20 * mm, H - 38, "AeroVista")
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 9)
    c.drawString(20 * mm, H - 52, "Connecting Horizons, Delivering Excellence")
    c.setFillColor(GOLD_LIGHT)
    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(W - 20 * mm, H - 38, "BOARDING PASS")

    # Two-column layout
    main_w = W * 0.66
    stub_w = W - main_w

    # Dotted separator
    c.setDash(3, 3)
    c.setStrokeColor(colors.HexColor("#cccccc"))
    c.line(main_w, 10, main_w, H - 60)
    c.setDash()

    def field(x, y, label, val, val_size=14):
        c.setFillColor(colors.HexColor("#888888"))
        c.setFont("Helvetica", 7)
        c.drawString(x, y + 18, label.upper())
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", val_size)
        c.drawString(x, y, str(val))

    # Main panel content
    y_base = H - 110
    field(20 * mm, y_base, "Passenger", f"{passenger.get('title','')} {passenger.get('first_name','')} {passenger.get('last_name','')}".upper())
    field(20 * mm, y_base - 35, "From", f"{flight.get('origin','')} • {flight.get('origin_city','')}".upper(), 13)
    field(120 * mm, y_base - 35, "To", f"{flight.get('destination','')} • {flight.get('destination_city','')}".upper(), 13)

    field(20 * mm, y_base - 75, "Flight", flight.get("flight_number", ""))
    field(70 * mm, y_base - 75, "Date", flight.get("departure_date", ""))
    field(120 * mm, y_base - 75, "Boarding", flight.get("boarding_time", ""))
    field(170 * mm, y_base - 75, "Departure", flight.get("departure_time", ""))

    field(20 * mm, y_base - 110, "Terminal", flight.get("terminal", "T2"))
    field(70 * mm, y_base - 110, "Gate", flight.get("gate", "TBA"))
    field(120 * mm, y_base - 110, "Seat", seat or "TBA", 18)
    field(170 * mm, y_base - 110, "Class", booking.get("cabin_class", "ECO").upper())

    # PNR
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20 * mm, 25 * mm, f"PNR: {booking.get('pnr','')}")
    c.setFillColor(colors.HexColor("#888888"))
    c.setFont("Helvetica", 8)
    c.drawString(20 * mm, 18 * mm, f"Ticket: {booking.get('ticket_number','')}")

    # QR on main panel
    qr_buf = io.BytesIO()
    qr = qrcode.QRCode(box_size=4, border=1)
    qr.add_data(f"PNR:{booking.get('pnr','')};SEAT:{seat};FL:{flight.get('flight_number','')}")
    qr.make(fit=True)
    qr.make_image(fill_color="black", back_color="white").save(qr_buf, format="PNG")
    qr_buf.seek(0)
    c.drawImage(ImageReader(qr_buf), main_w - 50 * mm, 20 * mm, width=30 * mm, height=30 * mm)

    # Stub panel (right)
    stub_x = main_w + 8
    c.setFillColor(MIDNIGHT)
    c.rect(stub_x, 10, stub_w - 18, H - 80, fill=1, stroke=0)

    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(stub_x + 12, H - 95, "BOARDING")

    def stub_field(y, label, val, size=12, color=WHITE):
        c.setFillColor(GOLD_LIGHT)
        c.setFont("Helvetica", 7)
        c.drawString(stub_x + 12, y + 14, label.upper())
        c.setFillColor(color)
        c.setFont("Helvetica-Bold", size)
        c.drawString(stub_x + 12, y, str(val))

    sy = H - 130
    stub_field(sy, "Passenger", f"{passenger.get('last_name','').upper()}", 11)
    stub_field(sy - 30, "Flight", flight.get("flight_number", ""), 12)
    stub_field(sy - 60, "From / To", f"{flight.get('origin','')}-{flight.get('destination','')}", 14, GOLD)
    stub_field(sy - 90, "Date", flight.get("departure_date", ""), 10)
    stub_field(sy - 115, "Gate", flight.get("gate", "TBA"), 12)
    stub_field(sy - 140, "Seat", seat or "TBA", 16, GOLD)
    stub_field(sy - 170, "PNR", booking.get("pnr", ""), 10)

    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()


def generate_invoice_pdf(booking: dict, flight: dict, passengers: list) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm,
                            topMargin=15 * mm, bottomMargin=15 * mm)
    styles = getSampleStyleSheet()
    story = []

    banner = Table([[
        Paragraph("<font color='#D4AF37' size=20><b>AeroVista Airlines</b></font><br/>"
                  "<font color='white' size=8>Connecting Horizons, Delivering Excellence</font>",
                  styles["Normal"]),
        Paragraph("<para align='right'><font color='#F3E5AB' size=14>TAX INVOICE</font><br/>"
                  f"<font color='white' size=9>Invoice: {booking.get('invoice_number','')}</font></para>",
                  styles["Normal"]),
    ]], colWidths=[110 * mm, 70 * mm])
    banner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
    ]))
    story.append(banner)
    story.append(Spacer(1, 10))

    bill = booking.get("billing", {})
    customer = Table([
        ["Bill To", "Booking Details"],
        [f"{bill.get('contact_name','')}\n{bill.get('contact_email','')}\n{bill.get('contact_mobile','')}\n"
         f"{bill.get('address_line1','')}\n{bill.get('city','')} {bill.get('postal_code','')}, {bill.get('country','')}",
         f"PNR: {booking.get('pnr','')}\nTicket: {booking.get('ticket_number','')}\n"
         f"Flight: {flight.get('flight_number','')}\nDate: {flight.get('departure_date','')}\n"
         f"Route: {flight.get('origin','')} → {flight.get('destination','')}"],
    ], colWidths=[90 * mm, 90 * mm])
    customer.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BACKGROUND", (0, 0), (-1, 0), GOLD),
        ("TEXTCOLOR", (0, 0), (-1, 0), NAVY),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#eeeeee")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(customer)
    story.append(Spacer(1, 12))

    fare = booking.get("fare", {})
    line_rows = [["Description", "Qty", "Unit", "Amount (INR)"]]
    line_rows.append([f"Air Ticket {flight.get('origin','')} → {flight.get('destination','')} "
                      f"({booking.get('cabin_class','economy').title()})",
                      str(len(passengers)), f"{fare.get('base_per_pax', 0):.2f}", f"{fare.get('base', 0):.2f}"])
    if fare.get("addons", 0) > 0:
        line_rows.append(["Seat / Meal / Baggage / Insurance", "-", "-", f"{fare.get('addons', 0):.2f}"])
    line_rows.append(["GST (5% / 12% based on class)", "-", "-", f"{fare.get('taxes', 0):.2f}"])
    line_rows.append(["Convenience Fee", "-", "-", f"{fare.get('convenience', 50):.2f}"])
    if fare.get("discount", 0) > 0:
        line_rows.append(["Promo Discount", "-", "-", f"- {fare.get('discount', 0):.2f}"])
    line_rows.append(["TOTAL", "", "", f"{fare.get('total', 0):.2f}"])
    items = Table(line_rows, colWidths=[90 * mm, 20 * mm, 30 * mm, 40 * mm])
    items.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BACKGROUND", (0, -1), (-1, -1), GOLD),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#eeeeee")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(items)
    story.append(Spacer(1, 12))

    story.append(Paragraph(
        "<font size=8 color='#888888'>This is a system-generated invoice and does not require signature. "
        "AeroVista Airlines • airlinesaerovista@gmail.com</font>", styles["Normal"]))

    doc.build(story)
    buf.seek(0)
    return buf.read()


def generate_receipt_pdf(payment: dict, booking: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm,
                            topMargin=15 * mm, bottomMargin=15 * mm)
    styles = getSampleStyleSheet()
    story = []

    banner = Table([[
        Paragraph("<font color='#D4AF37' size=20><b>AeroVista Airlines</b></font><br/>"
                  "<font color='white' size=8>Connecting Horizons, Delivering Excellence</font>",
                  styles["Normal"]),
        Paragraph("<para align='right'><font color='#F3E5AB' size=14>PAYMENT RECEIPT</font><br/>"
                  f"<font color='white' size=9>Receipt: {booking.get('receipt_number','')}</font></para>",
                  styles["Normal"]),
    ]], colWidths=[110 * mm, 70 * mm])
    banner.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), NAVY),
                                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                                ("TOPPADDING", (0, 0), (-1, -1), 14),
                                ("BOTTOMPADDING", (0, 0), (-1, -1), 14)]))
    story.append(banner)
    story.append(Spacer(1, 16))

    rows = [
        ["Receipt Number", booking.get("receipt_number", "")],
        ["Transaction ID", payment.get("transaction_id", "")],
        ["Booking PNR", booking.get("pnr", "")],
        ["Amount Paid", f"INR {payment.get('amount', 0):.2f}"],
        ["Payment Method", payment.get("method", "").replace("_", " ").title()],
        ["Status", payment.get("status", "SUCCESS").upper()],
        ["Date & Time", payment.get("paid_at", "")[:19].replace("T", " ")],
    ]
    t = Table(rows, colWidths=[60 * mm, 120 * mm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (0, -1), NAVY),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#eeeeee")),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(t)
    story.append(Spacer(1, 16))
    story.append(Paragraph(
        "<font size=9 color='#888888'>Thank you for choosing AeroVista Airlines.<br/>"
        "Customer Care: airlinesaerovista@gmail.com</font>", styles["Normal"]))

    doc.build(story)
    buf.seek(0)
    return buf.read()
