"""
NasCard — Organisation Pitch PowerPoint Generator
Run:  pip install python-pptx && python generate_nascard_pitch.py
Output: NasCard_Org_Pitch.pptx  (in same folder)
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

# ── Brand Colours ─────────────────────────────────────────────────────────────
NAVY       = RGBColor(0x0F, 0x17, 0x2A)
BLUE       = RGBColor(0x3B, 0x82, 0xF6)
GOLD       = RGBColor(0xF5, 0x9E, 0x0B)
WHITE      = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_GREY = RGBColor(0xCB, 0xD5, 0xE1)
DARK_CARD  = RGBColor(0x1E, 0x29, 0x3B)
GREEN      = RGBColor(0x10, 0xB9, 0x81)
RED        = RGBColor(0xEF, 0x44, 0x44)

prs = Presentation()
prs.slide_width  = Inches(13.33)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]

# ── Helpers ───────────────────────────────────────────────────────────────────
def fill_bg(slide, color):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color

def add_rect(slide, left, top, width, height, fill_color):
    shape = slide.shapes.add_shape(
        1, Inches(left), Inches(top), Inches(width), Inches(height)
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_color
    shape.line.fill.background()
    return shape

def add_text(slide, text, left, top, width, height,
             font_size=20, bold=False, color=WHITE,
             align=PP_ALIGN.LEFT, italic=False, wrap=True):
    txBox = slide.shapes.add_textbox(
        Inches(left), Inches(top), Inches(width), Inches(height)
    )
    txBox.word_wrap = wrap
    tf = txBox.text_frame
    tf.word_wrap = wrap
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = Pt(font_size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    return txBox

def bullet_block(slide, items, left, top, width, spacing=0.42, size=13, color=WHITE, bullet="▸ "):
    for i, item in enumerate(items):
        add_text(slide, bullet + item, left, top + i * spacing, width, 0.5,
                 font_size=size, color=color)

def section_header(slide, label, color=BLUE):
    add_rect(slide, 0.55, 0.18, 2.1, 0.07, color)
    add_text(slide, label.upper(), 0.55, 0.28, 8, 0.4,
             font_size=9, bold=True, color=color)

def divider(slide, top=1.05, color=BLUE):
    add_rect(slide, 0.55, top, 12.2, 0.025, color)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 1 — COVER
# ═══════════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
fill_bg(slide, NAVY)
add_rect(slide, 0, 0, 0.08, 7.5, BLUE)
add_rect(slide, 7.5, 0, 5.83, 7.5, DARK_CARD)
add_rect(slide, 7.5, 0, 5.83, 0.08, BLUE)

add_text(slide, "nas",  1.0, 1.8, 3,   1.2, font_size=72, bold=True, color=WHITE)
add_text(slide, "card", 2.82, 1.8, 4,  1.2, font_size=72, bold=True, color=BLUE)
add_text(slide, "Your Organisation's Identity,\nDigitised in Seconds.",
         1.0, 3.3, 6.2, 1.0, font_size=22, color=LIGHT_GREY)
add_text(slide, "Official Pitch to Partner Organisations  |  2026",
         1.0, 4.55, 6.5, 0.5, font_size=12, color=GOLD, italic=True)

add_rect(slide, 8.0, 1.5, 4.8, 2.8, RGBColor(0x1E, 0x3A, 0x8A))
add_rect(slide, 8.0, 1.5, 4.8, 0.12, GOLD)
add_text(slide, "STUDENT DIGITAL PASS",    8.15, 1.68, 4.5, 0.5, font_size=11, bold=True)
add_text(slide, "KWAME MENSAH",            8.15, 2.25, 4.5, 0.6, font_size=20, bold=True)
add_text(slide, "INDEX: UG/2026/4471",     8.15, 2.88, 4.5, 0.4, font_size=11, color=LIGHT_GREY)
add_text(slide, "BSc. Computer Science  |  Level 300", 8.15, 3.25, 4.5, 0.4, font_size=10, color=LIGHT_GREY)
add_text(slide, "ACTIVE",                  8.15, 3.68, 2,   0.35, font_size=10, bold=True, color=GREEN)
add_text(slide, "ASHESI UNIVERSITY",      10.5, 3.68, 2.5, 0.35, font_size=9,  bold=True, color=GOLD, align=PP_ALIGN.RIGHT)

add_rect(slide, 0.08, 6.5, 13.25, 0.92, DARK_CARD)
stats = [("10,000+","Students Enrolled"),("3 sec","Verification Speed"),("60 sec","Anti-Fraud QR"),("GHC 0","Printing Cost"),("5","Industry Verticals")]
for i, (val, label) in enumerate(stats):
    x = 0.5 + i * 2.6
    add_text(slide, val,   x, 6.55, 2.4, 0.45, font_size=18, bold=True, color=BLUE, align=PP_ALIGN.CENTER)
    add_text(slide, label, x, 7.0,  2.4, 0.35, font_size=9,  color=LIGHT_GREY, align=PP_ALIGN.CENTER)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 2 — THE PROBLEM
# ═══════════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
fill_bg(slide, NAVY)
add_rect(slide, 0, 0, 0.08, 7.5, RED)
section_header(slide, "The Problem", RED)
divider(slide, color=RED)
add_text(slide, "Managing physical ID cards is broken — and expensive.",
         0.55, 0.55, 11, 0.75, font_size=27, bold=True)

problems = [
    ("Lost / Damaged Cards",    "Students pay GHC 20-50 to replace a card. Process takes 1-2 weeks."),
    ("Slow Gate Verification",  "Guards manually check printed IDs. 30+ seconds per student at peak hours."),
    ("Bulk Enrollment Lag",     "Admins manually print thousands of PVC cards. Days of work, tonnes of plastic."),
    ("Photo Fraud via WhatsApp","Old card photos shared digitally to let others bypass security gates."),
    ("No Internet = No Check",  "Remote campuses cannot verify student status in real-time with no connectivity."),
    ("Massive Operational Cost","Annual ID card budget for a 10,000-student campus: GHC 250,000+"),
]

for i, (title, desc) in enumerate(problems):
    col, row = i % 2, i // 2
    x = 0.55 + col * 6.4
    y = 1.6 + row * 1.65
    add_rect(slide, x, y, 6.0, 1.45, DARK_CARD)
    add_rect(slide, x, y, 6.0, 0.06, RED)
    add_text(slide, title, x + 0.18, y + 0.12, 5.6, 0.45, font_size=13, bold=True)
    add_text(slide, desc,  x + 0.18, y + 0.62, 5.6, 0.72, font_size=11, color=LIGHT_GREY, wrap=True)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 3 — THE SOLUTION
# ═══════════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
fill_bg(slide, NAVY)
add_rect(slide, 0, 0, 0.08, 7.5, BLUE)
section_header(slide, "The Solution")
divider(slide)
add_text(slide, "NasCard: One app. Every identity. Verified in 3 seconds.",
         0.55, 0.55, 12, 0.75, font_size=26, bold=True)
add_text(slide, "NasCard is a digital identity platform that converts physical cards into secure 3D digital passes — stored in an encrypted vault on each member's phone.",
         0.55, 1.45, 12.2, 0.55, font_size=13, color=LIGHT_GREY, wrap=True)

solutions = [
    ("For Organisations", ["Design & issue branded digital passes", "Bulk-enroll 10,000 members in 30 seconds", "Real-time member status management", "Staff Kiosk Scanner for gate verification"]),
    ("For Members / Students", ["3D Apple Wallet-style card vault", "Show Gate Pass QR to guards in 1 tap", "Works offline — no internet required", "PIN + Biometric vault protection"]),
    ("For Security Staff", ["Type Index Number -> Photo in 3 seconds", "60-second anti-screenshot encrypted QR", "Zero training required", "Works at gate even with poor internet"]),
]

for i, (title, items) in enumerate(solutions):
    x = 0.55 + i * 4.1
    y = 2.35
    add_rect(slide, x, y, 3.85, 4.45, DARK_CARD)
    add_rect(slide, x, y, 3.85, 0.55, BLUE)
    add_text(slide, title, x + 0.15, y + 0.08, 3.6, 0.42, font_size=13, bold=True)
    bullet_block(slide, items, x + 0.15, y + 0.72, 3.6, spacing=0.86, size=11, color=LIGHT_GREY)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 4 — 5 INDUSTRY VERTICALS
# ═══════════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
fill_bg(slide, NAVY)
add_rect(slide, 0, 0, 0.08, 7.5, GOLD)
section_header(slide, "Industries We Serve", GOLD)
divider(slide, color=GOLD)
add_text(slide, "5 Industries. One Platform.", 0.55, 0.55, 9, 0.7, font_size=28, bold=True)

verticals = [
    ("Campus & Schools",       ["Student IDs", "Staff Badges", "Library Cards", "Hostel Access"]),
    ("Gyms & Fitness",         ["Membership Passes", "Check-In QR", "Freeze / Unfreeze", "Renewal Alerts"]),
    ("Corporate / Office",     ["Employee ID", "Visitor Passes", "HR Bulk Revoke", "Dept Badges"]),
    ("Church & Ministry",      ["Member Cards", "Cell Group IDs", "Event Attendance", "Directory Access"]),
    ("Events & Conferences",   ["VIP / General Tiers", "One-Time QR Tickets", "Live Dashboard", "No Print Cost"]),
]

for i, (name, items) in enumerate(verticals):
    x = 0.3 + i * 2.55
    y = 1.55
    add_rect(slide, x, y, 2.35, 5.4, DARK_CARD)
    add_rect(slide, x, y, 2.35, 0.06, GOLD)
    add_text(slide, name,  x + 0.12, y + 0.14, 2.15, 0.72, font_size=12, bold=True, align=PP_ALIGN.CENTER)
    bullet_block(slide, items, x + 0.12, y + 1.05, 2.15, spacing=0.75, size=10, color=LIGHT_GREY, bullet="• ")

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 5 — HOW IT WORKS
# ═══════════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
fill_bg(slide, NAVY)
add_rect(slide, 0, 0, 0.08, 7.5, BLUE)
section_header(slide, "How It Works")
divider(slide)
add_text(slide, "From Roster to Verified Gate Pass — in 4 Steps",
         0.55, 0.55, 11, 0.65, font_size=26, bold=True)

steps = [
    ("01", "Create Pass Studio",  "Admin selects industry, uploads logo & brand colours to design a digital pass."),
    ("02", "Bulk Enroll Members", "Upload student Excel roster. All 10,000 members receive invite links in 30 seconds."),
    ("03", "Members Claim Pass",  "Student enters invite code. 3D branded digital ID card appears in their vault instantly."),
    ("04", "Verified at the Gate","Student shows Gate Pass QR. Guard scans OR types Index No. Photo confirmed in 3 sec."),
]

for i, (num, title, desc) in enumerate(steps):
    x = 0.4 + i * 3.2
    y = 1.55
    add_rect(slide, x, y, 2.95, 5.1, DARK_CARD)
    add_rect(slide, x, y, 2.95, 0.07, BLUE)
    add_text(slide, num,   x + 0.15, y + 0.18, 1,   0.65, font_size=32, bold=True, color=BLUE)
    add_text(slide, title, x + 0.15, y + 0.92, 2.7, 0.72, font_size=14, bold=True)
    add_text(slide, desc,  x + 0.15, y + 1.72, 2.7, 3.2,  font_size=11, color=LIGHT_GREY, wrap=True)
    if i < 3:
        add_text(slide, "->", x + 3.04, y + 1.4, 0.3, 0.5, font_size=20, bold=True, color=BLUE, align=PP_ALIGN.CENTER)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 6 — ORG FEATURES
# ═══════════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
fill_bg(slide, NAVY)
add_rect(slide, 0, 0, 0.08, 7.5, BLUE)
section_header(slide, "Features for Your Organisation")
divider(slide)
add_text(slide, "Everything your admin team needs.", 0.55, 0.55, 10, 0.65, font_size=26, bold=True)

features = [
    ("Pass Creator Studio",      "Design fully branded digital passes with your logo, colours & card category."),
    ("Bulk CSV Import",          "Upload an Excel roster. All members receive invite links in under 30 seconds."),
    ("Staff Kiosk Scanner",      "Guards type Index Number. Verified photo + active status appears in 3 seconds."),
    ("Real-Time Roster Control", "Add, suspend, or revoke any member pass instantly from the dashboard."),
    ("Roster Export (CSV/SQL)",  "Download member data as CSV, JSON, or SQL — compatible with any system."),
    ("PVC Card Print Export",    "Export in printable PVC format when physical cards are needed as backup."),
    ("Verified Org Badge",       "Official nascard verification badge displayed on all your issued passes."),
    ("Multi-Org Management",     "One admin account can manage multiple campuses or departments simultaneously."),
]

for i, (title, desc) in enumerate(features):
    col, row = i % 2, i // 2
    x = 0.55 + col * 6.4
    y = 1.45 + row * 1.4
    add_rect(slide, x, y, 6.0, 1.2, DARK_CARD)
    add_text(slide, title, x + 0.18, y + 0.1, 5.6, 0.45, font_size=13, bold=True)
    add_text(slide, desc,  x + 0.18, y + 0.6, 5.6, 0.55, font_size=11, color=LIGHT_GREY, wrap=True)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 7 — SECURITY
# ═══════════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
fill_bg(slide, NAVY)
add_rect(slide, 0, 0, 0.08, 7.5, RED)
section_header(slide, "Security Architecture", RED)
divider(slide, color=RED)
add_text(slide, "Zero-Knowledge Pass Protocol -- Military-Grade Anti-Fraud.",
         0.55, 0.55, 12, 0.65, font_size=24, bold=True)
add_text(slide, "No QR code can be faked, shared, or replayed — ever.",
         0.55, 1.25, 12, 0.45, font_size=13, color=LIGHT_GREY)

layers = [
    ("Layer 1: Cryptographic Signature",  "Every QR token is signed with a device-unique secret key. Cannot be generated on another device."),
    ("Layer 2: 60-Second Time Window",    "QR codes self-invalidate after 60 seconds. A screenshot becomes worthless immediately."),
    ("Layer 3: Server-First Verification","Guard scanner hits the live cloud roster first. Confirms member is still active in real time."),
    ("Layer 4: Offline Encrypted Fallback","If no internet, verifies against locally-cached encrypted roster. No single point of failure."),
    ("Layer 5: App Lock",                 "6-digit PIN, Face ID, and Fingerprint vault protection. Cards inaccessible without auth."),
    ("Layer 6: Encrypted Vault",          "All card data encrypted at rest on the device. No raw data sent to cloud without consent."),
]

for i, (title, desc) in enumerate(layers):
    col, row = i % 2, i // 2
    x = 0.55 + col * 6.4
    y = 1.9 + row * 1.6
    add_rect(slide, x, y, 6.0, 1.4, DARK_CARD)
    add_rect(slide, x, y, 0.07, 1.4, RED)
    add_text(slide, title, x + 0.25, y + 0.1,  5.6, 0.5,  font_size=12, bold=True)
    add_text(slide, desc,  x + 0.25, y + 0.65, 5.5, 0.65, font_size=11, color=LIGHT_GREY, wrap=True)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 8 — IMPACT & ROI
# ═══════════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
fill_bg(slide, NAVY)
add_rect(slide, 0, 0, 0.08, 7.5, GREEN)
section_header(slide, "Impact & Return on Investment", GREEN)
divider(slide, color=GREEN)
add_text(slide, "Real numbers. Real savings.", 0.55, 0.55, 10, 0.65, font_size=26, bold=True)

big_stats = [
    ("30 sec",  "Enroll 10,000\nmembers via CSV"),
    ("GHC 0",   "Plastic card\nprinting cost"),
    ("3 sec",   "Gate verification\nspeed (vs 30s manual)"),
    ("60 sec",  "QR anti-fraud\nprotection window"),
]

for i, (val, label) in enumerate(big_stats):
    x = 0.55 + i * 3.1
    y = 1.45
    add_rect(slide, x, y, 2.85, 1.85, DARK_CARD)
    add_rect(slide, x, y, 2.85, 0.07, GREEN)
    add_text(slide, val,   x + 0.15, y + 0.18, 2.6, 0.75, font_size=26, bold=True, color=GREEN, align=PP_ALIGN.CENTER)
    add_text(slide, label, x + 0.15, y + 1.0,  2.6, 0.75, font_size=10, color=LIGHT_GREY, align=PP_ALIGN.CENTER)

add_text(slide, "Before vs After NasCard", 0.55, 3.55, 6, 0.45, font_size=14, bold=True)

rows = [
    ("Card Issuance Time",     "2-4 weeks (manual print)", "30 seconds (CSV upload)"),
    ("Cost per Card",          "GHC 20-50 (PVC + print)", "GHC 0 (digital)"),
    ("Gate Verification",      "30 seconds per student",   "3 seconds per student"),
    ("Lost Card Replacement",  "1-2 weeks + GHC 50 fee",  "Instant re-issue from dashboard"),
    ("Fraud Risk",             "High (photo sharing)",     "None (ZK 60-sec QR)"),
    ("Remote Suspension",      "Not possible",             "Instant, one tap from dashboard"),
]

headers = ["Metric", "Before NasCard", "With NasCard"]
col_widths = [3.1, 3.5, 3.5]
col_starts = [0.55, 3.7, 7.25]
header_y = 4.1

for j, (hdr, cw, cx) in enumerate(zip(headers, col_widths, col_starts)):
    add_rect(slide, cx, header_y, cw - 0.08, 0.4, BLUE if j == 2 else DARK_CARD)
    add_text(slide, hdr, cx + 0.1, header_y + 0.05, cw, 0.35, font_size=11, bold=True)

for r, (metric, before, after) in enumerate(rows):
    ry = header_y + 0.45 + r * 0.45
    bg = RGBColor(0x16, 0x20, 0x30) if r % 2 == 0 else DARK_CARD
    for j, (val, cw, cx) in enumerate(zip([metric, before, after], col_widths, col_starts)):
        add_rect(slide, cx, ry, cw - 0.08, 0.42, RGBColor(0x0C, 0x2A, 0x18) if j == 2 else bg)
        c = GREEN if j == 2 else (RED if j == 1 else LIGHT_GREY)
        add_text(slide, val, cx + 0.1, ry + 0.05, cw, 0.35, font_size=10, color=c)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 9 — BUSINESS MODEL
# ═══════════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
fill_bg(slide, NAVY)
add_rect(slide, 0, 0, 0.08, 7.5, GOLD)
section_header(slide, "Business Model & Pricing", GOLD)
divider(slide, color=GOLD)
add_text(slide, "Flexible plans for every organisation size.", 0.55, 0.55, 10, 0.65, font_size=26, bold=True)

plans = [
    ("FREE",         "Individual",          "GHC 0/mo",   WHITE, ["Up to 5 digital cards","Basic vault access","Personal use only"]),
    ("PRO",          "Power Users",         "GHC 25/mo",  BLUE,  ["Unlimited cards","All premium features","Priority support"]),
    ("ORG STARTER",  "Small Orgs",          "GHC 99/mo",  GOLD,  ["Up to 500 members","Staff Kiosk Scanner","Basic analytics"]),
    ("ORG GROWTH",   "Universities / Corps","GHC 299/mo", GREEN, ["Unlimited members","Bulk CSV import","Full analytics","Roster export"]),
    ("ENTERPRISE",   "Govt / Large Inst.",  "Custom",     RED,   ["White-label branding","API access","Dedicated server","SLA support"]),
]

for i, (plan, target, price, color, feats) in enumerate(plans):
    x = 0.3 + i * 2.55
    y = 1.5
    add_rect(slide, x, y, 2.35, 5.5, DARK_CARD)
    add_rect(slide, x, y, 2.35, 0.07, color)
    add_text(slide, plan,   x + 0.12, y + 0.15, 2.15, 0.5,  font_size=13, bold=True, color=color)
    add_text(slide, target, x + 0.12, y + 0.68, 2.15, 0.45, font_size=10, color=LIGHT_GREY)
    add_text(slide, price,  x + 0.12, y + 1.2,  2.15, 0.6,  font_size=16, bold=True)
    bullet_block(slide, feats, x + 0.12, y + 2.0, 2.15, spacing=0.72, size=10, color=LIGHT_GREY, bullet="+ ")
    if plan == "ORG GROWTH":
        add_rect(slide, x, y + 5.22, 2.35, 0.3, GREEN)
        add_text(slide, "RECOMMENDED", x + 0.1, y + 5.25, 2.15, 0.25,
                 font_size=9, bold=True, align=PP_ALIGN.CENTER)

add_text(slide, "Payment via Paystack (Ghana & Nigeria)  |  Additional gateways on request",
         0.55, 7.1, 12.2, 0.35, font_size=10, color=LIGHT_GREY, align=PP_ALIGN.CENTER, italic=True)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 10 — CAMPUS SCENARIO
# ═══════════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
fill_bg(slide, NAVY)
add_rect(slide, 0, 0, 0.08, 7.5, BLUE)
section_header(slide, "Real-World Scenario: University Campus")
divider(slide)
add_text(slide, "How NasCard works at Ashesi University", 0.55, 0.55, 11, 0.65, font_size=24, bold=True)

scenarios = [
    ("Admin (IT Department)", [
        "Opens nascard Pass Creator Studio",
        "Creates Ashesi Student ID 2026 pass",
        "Uploads 10,000-row Excel roster",
        "All students get invite in 30 seconds",
        "Shares Staff Kiosk link to security",
    ]),
    ("Student (Kwame, Level 3)", [
        "Receives SMS: 'Claim your Ashesi Digital Pass'",
        "Opens nascard, enters ASHESI-2026",
        "3D branded card appears in vault",
        "At gate: taps Show Gate Pass QR",
        "60-second QR shown. Invigilator scans. Done.",
    ]),
    ("Security Guard (Gate 1)", [
        "Opens Staff Kiosk on phone/tablet",
        "Types student Index Number",
        "Kwame's photo + ACTIVE status appear",
        "3 seconds. Green checkmark confirmed.",
        "No fake card is possible. Zero fraud.",
    ]),
]

for i, (title, items) in enumerate(scenarios):
    x = 0.55 + i * 4.1
    y = 1.5
    add_rect(slide, x, y, 3.85, 5.35, DARK_CARD)
    add_rect(slide, x, y, 3.85, 0.5, BLUE)
    add_text(slide, title, x + 0.15, y + 0.08, 3.6, 0.4, font_size=12, bold=True)
    bullet_block(slide, items, x + 0.15, y + 0.72, 3.6, spacing=0.93, size=11, color=LIGHT_GREY)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 11 — COMPETITIVE MATRIX
# ═══════════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
fill_bg(slide, NAVY)
add_rect(slide, 0, 0, 0.08, 7.5, GOLD)
section_header(slide, "Competitive Advantage", GOLD)
divider(slide, color=GOLD)
add_text(slide, "Why NasCard wins.", 0.55, 0.55, 10, 0.65, font_size=26, bold=True)

t_headers  = ["Feature", "Apple Wallet", "Google Wallet", "Printed IDs", "NasCard"]
col_w  = [3.2, 2.0, 2.1, 2.0, 2.1]
col_x  = [0.55, 3.8, 5.85, 7.98, 10.03]
header_y = 1.45

for j, (hdr, cw, cx) in enumerate(zip(t_headers, col_w, col_x)):
    add_rect(slide, cx, header_y, cw - 0.1, 0.5, BLUE if j == 4 else DARK_CARD)
    add_text(slide, hdr, cx + 0.12, header_y + 0.08, cw, 0.38,
             font_size=11, bold=True, color=GOLD if j == 4 else WHITE)

C = "YES"; X = "NO"; P = "PARTIAL"
rows_data = [
    ("Org Pass Issuance",        X, X, C, C),
    ("Bulk CSV Enrollment",      X, X, X, C),
    ("Anti-Fraud 60s QR",        X, X, X, C),
    ("Offline Gate Verify",      X, X, P, C),
    ("Staff Kiosk Scanner",      X, X, X, C),
    ("Africa Payment Gateway",   X, X, P, C),
    ("Multi-Vertical (5 types)", X, X, X, C),
    ("Member Dashboard",         X, X, X, C),
    ("App Lock + Biometrics",    C, C, X, C),
    ("Works on Any Phone",       P, P, C, C),
]

for r, (label, *vals) in enumerate(rows_data):
    ry = header_y + 0.55 + r * 0.52
    bg = RGBColor(0x16, 0x20, 0x30) if r % 2 == 0 else DARK_CARD
    all_cells = [label] + vals
    for j, (cell, cw, cx) in enumerate(zip(all_cells, col_w, col_x)):
        add_rect(slide, cx, ry, cw - 0.1, 0.5,
                 RGBColor(0x0C, 0x2A, 0x18) if j == 4 else bg)
        c = GREEN if (j == 4 and cell == C) else (RED if cell == X and j > 0 else LIGHT_GREY)
        add_text(slide, cell, cx + 0.12, ry + 0.06, cw, 0.4,
                 font_size=10, color=c,
                 align=PP_ALIGN.CENTER if j > 0 else PP_ALIGN.LEFT)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 12 — ROADMAP
# ═══════════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
fill_bg(slide, NAVY)
add_rect(slide, 0, 0, 0.08, 7.5, BLUE)
section_header(slide, "Product Roadmap")
divider(slide)
add_text(slide, "Where we're going next.", 0.55, 0.55, 10, 0.65, font_size=26, bold=True)

phases = [
    ("NOW  (Month 1)",       RED,  ["App Store Launch (iOS & Android)", "Referral Code Sharing System", "Push Notification Engine", "NFC Tap-to-Share Cards"]),
    ("SOON  (Month 2-3)",    GOLD, ["Org Admin Web Dashboard", "Student Portal (Web App)", "Attendance Analytics Charts", "Multi-Language Support", "Auto-Renewal Payments"]),
    ("FUTURE  (6-12 Months)",GREEN,["Blockchain Credential Anchoring", "Ghana Card / NIN Integration", "Smart Gate Hardware SDK", "Apple Watch / WearOS Support", "Bank Loyalty Tokenization"]),
]

for i, (phase, color, items) in enumerate(phases):
    x = 0.55 + i * 4.2
    y = 1.45
    add_rect(slide, x, y, 3.95, 5.4, DARK_CARD)
    add_rect(slide, x, y, 3.95, 0.07, color)
    add_text(slide, phase, x + 0.15, y + 0.15, 3.7, 0.55, font_size=13, bold=True, color=color)
    bullet_block(slide, items, x + 0.15, y + 0.9, 3.7, spacing=0.9, size=11, color=LIGHT_GREY)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 13 — PARTNERSHIP OFFER
# ═══════════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
fill_bg(slide, NAVY)
add_rect(slide, 0, 0, 0.08, 7.5, GOLD)
section_header(slide, "Partner With Us", GOLD)
divider(slide, color=GOLD)
add_text(slide, "What we offer your organisation.", 0.55, 0.55, 10, 0.65, font_size=26, bold=True)

offers = [
    ("Free 3-Month Pilot",         "We set everything up — zero IT effort. Full platform access at no cost for the pilot period."),
    ("Full White-Label Option",    "Your logo, your colours, your domain name. Looks like your own app — powered by NasCard."),
    ("Dedicated Onboarding",       "Our team trains your admin staff and security guards. Typically 1 day of hands-on onboarding."),
    ("Priority WhatsApp Support",  "Dedicated support line for partner institutions. Response within 2 hours, guaranteed."),
    ("Monthly Analytics Report",   "Gate scan volume, active members, fraud attempts, and peak hours — delivered monthly."),
    ("REST API Integration",       "Connect nascard verification to your existing student portal or attendance system via API."),
]

for i, (title, desc) in enumerate(offers):
    col, row = i % 2, i // 2
    x = 0.55 + col * 6.4
    y = 1.45 + row * 1.7
    add_rect(slide, x, y, 6.0, 1.5, DARK_CARD)
    add_rect(slide, x, y, 6.0, 0.07, GOLD)
    add_text(slide, title, x + 0.18, y + 0.15, 5.6, 0.45, font_size=13, bold=True)
    add_text(slide, desc,  x + 0.18, y + 0.68, 5.6, 0.75, font_size=11, color=LIGHT_GREY, wrap=True)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE 14 — CLOSING CTA
# ═══════════════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(BLANK)
fill_bg(slide, NAVY)
add_rect(slide, 0, 0, 0.08, 7.5, BLUE)
add_rect(slide, 0, 6.8, 13.33, 0.7, DARK_CARD)

add_text(slide, "nas",  1.6, 1.0, 3.5, 1.3, font_size=68, bold=True, color=WHITE, align=PP_ALIGN.RIGHT)
add_text(slide, "card", 4.8, 1.0, 4.5, 1.3, font_size=68, bold=True, color=BLUE)

add_text(slide, "The future of organisational identity is already here.",
         1.0, 2.7, 11.3, 0.75, font_size=20, color=LIGHT_GREY, align=PP_ALIGN.CENTER)

add_rect(slide, 3.5, 4.0, 6.3, 1.85, DARK_CARD)
add_rect(slide, 3.5, 4.0, 6.3, 0.07, BLUE)
add_text(slide, "Start Your Free 3-Month Pilot Today",
         3.65, 4.12, 6.0, 0.5, font_size=16, bold=True, align=PP_ALIGN.CENTER)
add_text(slide, "Email:  hello@nascard.app",
         3.65, 4.72, 6.0, 0.4, font_size=13, color=LIGHT_GREY, align=PP_ALIGN.CENTER)
add_text(slide, "Web:    www.nascard.app",
         3.65, 5.12, 6.0, 0.4, font_size=13, color=BLUE, align=PP_ALIGN.CENTER)
add_text(slide, "WhatsApp:  +233 XX XXX XXXX",
         3.65, 5.52, 6.0, 0.4, font_size=13, color=GREEN, align=PP_ALIGN.CENTER)

add_text(slide, "(c) 2026 NasCard  |  Built for African institutions  |  Powered by Paystack",
         0.55, 6.88, 12.2, 0.4, font_size=9, color=LIGHT_GREY, align=PP_ALIGN.CENTER, italic=True)

# ═══════════════════════════════════════════════════════════════════════════════
# SAVE
# ═══════════════════════════════════════════════════════════════════════════════
output_path = "NasCard_Org_Pitch.pptx"
prs.save(output_path)
print(f"\n  Saved: {output_path}")
print(f"  Slides: {len(prs.slides)}")
print("  Open in Microsoft PowerPoint or Google Slides.")
print("  Tip: In Google Slides, go to File > Import Slides to use.")
