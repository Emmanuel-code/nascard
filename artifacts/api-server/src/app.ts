import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const allowedOrigins = [
  process.env.EXPO_PUBLIC_DOMAIN,
  "https://nascard-api.onrender.com",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:8081",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, React Native WebViews, curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.some((allowed) => allowed && origin.includes(allowed))) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Manager-Pin", "X-Api-Key"],
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Root Landing Page for Web Browsers
app.get("/", (_req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>nascard 3D Pass & Wallet API</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #080C16; color: #FFFFFF; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #131A2A; border: 1px solid #232E45; border-radius: 24px; padding: 36px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .badge { display: inline-flex; align-items: center; gap: 6px; background: #10B98122; color: #10B981; border: 1px solid #10B98144; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 1px; margin-bottom: 20px; }
    .dot { width: 8px; height: 8px; background: #10B981; border-radius: 50%; display: inline-block; }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 12px; }
    p { color: #94A3B8; font-size: 14px; line-height: 1.6; margin-bottom: 28px; }
    .status-box { background: #080C16; border: 1px solid #232E45; border-radius: 14px; padding: 16px; margin-bottom: 24px; text-align: left; }
    .status-row { display: flex; justify-content: space-between; font-size: 13px; color: #94A3B8; padding: 6px 0; border-bottom: 1px solid #1E293B; }
    .status-row:last-child { border-bottom: none; }
    .status-val { color: #FFFFFF; font-weight: 600; }
    .btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; background: #3B82F6; color: #FFFFFF; text-decoration: none; font-weight: 700; font-size: 15px; padding: 16px; border-radius: 14px; margin-bottom: 12px; }
    .footer { margin-top: 20px; font-size: 12px; color: #64748B; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge"><span class="dot"></span> SERVER ONLINE & OPERATIONAL</div>
    <h1>nascard Cloud API</h1>
    <p>Official backend API engine for nascard 3D Digital Card Wallet, Paystack Mobile Money payments, and Gemini 2.5 Flash Vision OCR.</p>
    
    <div class="status-box">
      <div class="status-row"><span>Environment</span><span class="status-val">Production (Render Cloud)</span></div>
      <div class="status-row"><span>OCR Engine</span><span class="status-val">⚡ Gemini 2.5 Flash (~400ms)</span></div>
      <div class="status-row"><span>Payment Gateway</span><span class="status-val">💳 Paystack Ghana (GHS)</span></div>
      <div class="status-row"><span>Developer</span><span class="status-val">Septnova (Emmanuel Jimah Bakeri)</span></div>
    </div>

    <a href="https://play.google.com/store/apps/details?id=com.nascard.app" class="btn">🤖 Download nascard App</a>
    <div class="footer">© 2026 Septnova. All rights reserved. • Contact: septnova.contact@gmail.com</div>
  </div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

// Also mount Web Smart Landing Page at /join/:id directly on root
app.get("/join/:id", (req, res) => {
  const query = String(req.params["id"] || "");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Join Digital Pass on nascard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #080C16; color: #FFFFFF; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #131A2A; border: 1px solid #232E45; border-radius: 24px; padding: 32px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .badge { display: inline-block; background: #3B82F622; color: #3B82F6; border: 1px solid #3B82F644; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 1px; margin-bottom: 16px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 12px; }
    p { color: #94A3B8; font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
    .code-box { background: #080C16; border: 1px dashed #3B82F6; padding: 14px; border-radius: 12px; font-size: 18px; font-weight: 700; color: #3B82F6; margin-bottom: 24px; letter-spacing: 2px; }
    .btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; background: #3B82F6; color: #FFFFFF; text-decoration: none; font-weight: 700; font-size: 16px; padding: 16px; border-radius: 14px; margin-bottom: 12px; }
    .btn-sec { background: #1E293B; color: #FFFFFF; border: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">OFFICIAL PASS</div>
    <h1>Claim your Digital Pass</h1>
    <p>You have been invited to claim your official digital membership ID pass inside your 3D nascard Wallet.</p>
    
    <div class="code-box">Invite Code: ${query}</div>

    <a href="nascard://org/join/${query}" class="btn">📱 Open in nascard App</a>
    <a href="https://play.google.com/store/apps/details?id=com.nascard.app" class="btn btn-sec">🤖 Download on Google Play Store</a>
  </div>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

// ─── Paystack Gateway Readiness Guard ──────────────────────────────────────────
const paystackKey = process.env["PAYSTACK_SECRET_KEY"] || "";
if (paystackKey.startsWith("sk_live_")) {
  logger.info("💳 [PAYSTACK GATEWAY READY]: LIVE Production Key Detected (sk_live_***).");
} else if (paystackKey.startsWith("sk_test_")) {
  logger.info("💳 [PAYSTACK GATEWAY READY]: TEST Sandbox Key Detected (sk_test_***).");
} else {
  logger.warn("⚠️ [PAYSTACK GATEWAY NOTICE]: PAYSTACK_SECRET_KEY environment variable not set. Paystack endpoints will return 503 until configured.");
}

app.use("/api", router);

// ─── Legal Pages ────────────────────────────────────────────────────────────
const LEGAL_CSS = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0D1117; color: #E6EDF3; max-width: 720px; margin: 0 auto; padding: 40px 20px; line-height: 1.7; }
  h1 { color: #58A6FF; font-size: 1.8rem; margin-bottom: 6px; }
  h2 { color: #79C0FF; font-size: 1.1rem; margin-top: 32px; }
  p, li { color: #C9D1D9; }
  .badge { display: inline-block; background: #1F6FEB22; color: #58A6FF; border: 1px solid #58A6FF44; padding: 3px 12px; border-radius: 20px; font-size: 12px; margin-bottom: 16px; }
  footer { margin-top: 48px; color: #6E7681; font-size: 12px; }
`;

app.get("/privacy-policy", (_req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Privacy Policy — nascard</title>
  <style>${LEGAL_CSS}</style>
</head>
<body>
  <div class="badge">nascard · Septnova</div>
  <h1>Privacy Policy</h1>
  <p>Last updated: ${new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

  <h2>1. Data Storage</h2>
  <p>Your personal card photos, ID numbers, and profile details are encrypted and stored <strong>locally on your device</strong> using industry-standard AES-256 encryption. We never store your card data on our servers without your explicit action (Cloud Backup, which is also AES-256 encrypted end-to-end).</p>

  <h2>2. Camera &amp; Photo Access</h2>
  <p>Camera permissions are used exclusively for capturing card photos and scanning barcodes in the app. No photos are transmitted to any third party.</p>

  <h2>3. Location Access</h2>
  <p>Optional location access is used only to suggest relevant cards near your current location (e.g., your gym membership when near a gym). Location data is never stored or transmitted externally.</p>

  <h2>4. Zero Data Selling</h2>
  <p>Septnova Ltd never sells, leases, or shares your personal card data with any third party for marketing, advertising, or any other commercial purpose.</p>

  <h2>5. Payment Data</h2>
  <p>All payment processing is handled securely by <strong>Paystack</strong>. nascard does not store or transmit payment card numbers or bank credentials.</p>

  <h2>6. Contact</h2>
  <p>Questions? Email us at <a href="mailto:privacy@septnova.com" style="color:#58A6FF">privacy@septnova.com</a></p>

  <footer>&copy; ${new Date().getFullYear()} Septnova Ltd. All rights reserved.</footer>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

app.get("/terms-of-service", (_req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Terms of Service — nascard</title>
  <style>${LEGAL_CSS}</style>
</head>
<body>
  <div class="badge">nascard · Septnova</div>
  <h1>Terms of Service</h1>
  <p>Last updated: ${new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

  <h2>1. Acceptable Use</h2>
  <p>You agree to upload only legitimate document photos that belong to you or your organization. Uploading counterfeit, fraudulent, or stolen documents is strictly prohibited and may be reported to relevant authorities.</p>

  <h2>2. Organization Passes</h2>
  <p>Official digital passes issued by partner organizations (gyms, schools, clubs) are verified using dynamic cryptographic QR tokens. Passes may be revoked at any time by the issuing organization.</p>

  <h2>3. Pro Subscription &amp; Payments</h2>
  <p>Pro memberships are billed via Paystack at the rates shown in the app (GH₵ 19/month annual, GH₵ 29/month monthly). You may cancel at any time. Cancellation takes effect at the end of your current billing cycle.</p>

  <h2>4. Intellectual Property</h2>
  <p>The nascard app, its branding, and underlying technology are owned by Septnova Ltd. You are granted a limited, non-transferable licence to use the app on your devices.</p>

  <h2>5. Disclaimer of Warranties</h2>
  <p>nascard is provided "as is" without warranties of any kind. Septnova shall not be liable for data loss resulting from device failure or user error.</p>

  <h2>6. Contact</h2>
  <p>Questions? Email <a href="mailto:septnova.contact@gmail.com" style="color:#58A6FF">septnova.contact@gmail.com</a></p>

  <footer>&copy; ${new Date().getFullYear()} Septnova Ltd. All rights reserved.</footer>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

export default app;
