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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.use("/api", router);

export default app;
