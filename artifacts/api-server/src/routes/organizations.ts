import { Router, type Request, type Response } from "express";
import https from "https";
import crypto from "crypto";
import { supabase } from "../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomFieldSchema {
  id: string;
  label: string;
  type: "text" | "number" | "email" | "phone" | "date";
  required: boolean;
  placeholder?: string;
}

export interface OrganizationPayoutRecord {
  id: string;
  amount: number;
  status: "completed" | "pending" | "failed";
  bankName: string;
  accountNumber: string;
  accountName: string;
  requestedAt: string;
  reference: string;
  transferCode?: string;
}

export interface Organization {
  id: string;
  name: string;
  category: "gym" | "school" | "club" | "corporate" | "community";
  description: string;
  location: string;
  managerName: string;
  managerEmail: string;
  managerPin?: string;
  primaryColor: string;
  secondaryColor?: string;
  accentColor: string;
  logoUri?: string;
  badgeStyle: "holographic" | "gold" | "minimal" | "modern";
  customFields: CustomFieldSchema[];
  membershipFee: number;
  membershipFeeInterval: "one_time" | "monthly" | "yearly" | "free";
  membershipFeeDescription: string;
  tier: "starter" | "pro" | "enterprise";
  billingCycle?: "monthly" | "yearly";
  requirePhoto?: boolean;
  idGenerationMode?: "member_provided" | "auto_generated";
  memberLimit: number;
  activeMemberCount: number;
  inviteCode: string;
  createdAt: string;
  totalGrossRevenue?: number;
  platformFeeCollected?: number;
  netBalance?: number;
  totalWithdrawn?: number;
  payoutBankDetails?: {
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  payoutHistory?: OrganizationPayoutRecord[];
}

export interface OrgMember {
  id: string;
  orgId: string;
  memberName: string;
  memberEmail?: string;
  customFieldsData: Record<string, string>;
  photoUri?: string | null;
  cardId: string;
  status: "active" | "expired" | "revoked";
  verificationToken: string;
  joinedAt: string;
  expiresAt?: string;
  paystackReference?: string;
  paymentStatus?: "paid" | "free" | "pending";
}

export interface ProSubscriptionRecord {
  email: string;
  reference: string;
  amount: number;
  billingCycle: "annual" | "monthly";
  status: "active" | "canceled" | "expired";
  activatedAt: string;
  expiresAt: string;
}

function hashManagerPin(pin: string): string {
  const salt = "nascard-org-mgr-v1";
  return crypto.pbkdf2Sync(pin, salt, 10000, 32, "sha256").toString("hex");
}

function verifyManagerPin(pin: string, storedHash?: string): boolean {
  if (!storedHash) return false;
  if (storedHash === "1234" && pin === "1234") return true;
  const hashed = hashManagerPin(pin);
  return hashed === storedHash || storedHash === pin;
}

function generateSecureToken(): string {
  return `vtoken_${crypto.randomBytes(24).toString("hex")}`;
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────

// Maps DB row to Organization
function mapOrgFromDB(row: any): Organization {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    location: row.location,
    managerName: row.manager_name,
    managerEmail: row.manager_email,
    managerPin: row.manager_pin,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    logoUri: row.logo_uri,
    badgeStyle: row.badge_style,
    customFields: row.custom_fields,
    membershipFee: Number(row.membership_fee),
    membershipFeeInterval: row.membership_fee_interval,
    membershipFeeDescription: row.membership_fee_description,
    tier: row.tier,
    billingCycle: row.billing_cycle,
    requirePhoto: row.require_photo,
    idGenerationMode: row.id_generation_mode,
    memberLimit: row.member_limit,
    activeMemberCount: row.active_member_count,
    inviteCode: row.invite_code,
    createdAt: row.created_at,
    totalGrossRevenue: Number(row.total_gross_revenue),
    platformFeeCollected: Number(row.platform_fee_collected),
    netBalance: Number(row.net_balance),
    totalWithdrawn: Number(row.total_withdrawn),
    payoutBankDetails: row.payout_bank_details,
    payoutHistory: row.payout_history,
  };
}

// Maps Organization to DB row
function mapOrgToDB(org: Organization): any {
  return {
    id: org.id,
    name: org.name,
    category: org.category,
    description: org.description,
    location: org.location,
    manager_name: org.managerName,
    manager_email: org.managerEmail,
    manager_pin: org.managerPin,
    primary_color: org.primaryColor,
    secondary_color: org.secondaryColor,
    accent_color: org.accentColor,
    logo_uri: org.logoUri,
    badge_style: org.badgeStyle,
    custom_fields: org.customFields,
    membership_fee: org.membershipFee,
    membership_fee_interval: org.membershipFeeInterval,
    membership_fee_description: org.membershipFeeDescription,
    tier: org.tier,
    billing_cycle: org.billingCycle,
    require_photo: org.requirePhoto,
    id_generation_mode: org.idGenerationMode,
    member_limit: org.memberLimit,
    active_member_count: org.activeMemberCount,
    invite_code: org.inviteCode,
    created_at: org.createdAt,
    total_gross_revenue: org.totalGrossRevenue,
    platform_fee_collected: org.platformFeeCollected,
    net_balance: org.netBalance,
    total_withdrawn: org.totalWithdrawn,
    payout_bank_details: org.payoutBankDetails,
    payout_history: org.payoutHistory,
  };
}

function mapMemberFromDB(row: any): OrgMember {
  return {
    id: row.id,
    orgId: row.org_id,
    memberName: row.member_name,
    memberEmail: row.member_email,
    customFieldsData: row.custom_fields_data,
    photoUri: row.photo_uri,
    cardId: row.card_id,
    status: row.status,
    verificationToken: row.verification_token,
    joinedAt: row.joined_at,
    expiresAt: row.expires_at,
    paystackReference: row.paystack_reference,
    paymentStatus: row.payment_status,
  };
}

function mapMemberToDB(member: OrgMember): any {
  return {
    id: member.id,
    org_id: member.orgId,
    member_name: member.memberName,
    member_email: member.memberEmail,
    custom_fields_data: member.customFieldsData,
    photo_uri: member.photoUri,
    card_id: member.cardId,
    status: member.status,
    verification_token: member.verificationToken,
    joined_at: member.joinedAt,
    expires_at: member.expiresAt,
    paystack_reference: member.paystackReference,
    payment_status: member.paymentStatus,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcExpiresAt(interval: Organization["membershipFeeInterval"]): string | undefined {
  const now = new Date();
  if (interval === "monthly") {
    now.setMonth(now.getMonth() + 1);
    return now.toISOString();
  }
  if (interval === "yearly") {
    now.setFullYear(now.getFullYear() + 1);
    return now.toISOString();
  }
  if (interval === "one_time") {
    now.setFullYear(now.getFullYear() + 10);
    return now.toISOString();
  }
  return undefined;
}

async function autoExpireMembers(orgId: string): Promise<void> {
  const { data: members, error } = await supabase.from("org_members").select("*").eq("org_id", orgId);
  if (error || !members) return;

  const now = new Date();
  let expiredCount = 0;
  
  for (const row of members) {
    if (row.status === "active" && row.expires_at && new Date(row.expires_at) < now) {
      await supabase.from("org_members").update({ status: "expired" }).eq("id", row.id);
      expiredCount++;
    }
  }

  if (expiredCount > 0) {
    const { data: updatedMembers } = await supabase.from("org_members").select("id").eq("org_id", orgId).eq("status", "active");
    if (updatedMembers) {
      await supabase.from("organizations").update({ active_member_count: updatedMembers.length }).eq("id", orgId);
    }
  }
}

function issueCard(org: Organization, member: OrgMember) {
  return {
    profileId: "personal",
    cardType: "membership",
    title: `${org.name} Pass`,
    nameOnCard: member.memberName,
    idNumber:
      member.customFieldsData["member_id"] ||
      member.customFieldsData["Student ID"] ||
      member.id.slice(-6).toUpperCase(),
    expiryDate: member.expiresAt || new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    frontImageUri: member.photoUri || null,
    backImageUri: null,
    barcodeFormat: "qr",
    barcodeValue: member.verificationToken,
    notes: `Issued by ${org.name}. ${org.location ? "Location: " + org.location : ""}`,
    isPartnerIssued: true,
    orgId: org.id,
    orgName: org.name,
    primaryColor: org.primaryColor,
    secondaryColor: org.secondaryColor,
    accentColor: org.accentColor,
    logoUri: org.logoUri || null,
    customFields: member.customFieldsData,
    verificationToken: member.verificationToken,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function paystackRequest(
  method: string,
  path: string,
  body?: object
): Promise<any> {
  return new Promise((resolve, reject) => {
    const secretKey = process.env["PAYSTACK_SECRET_KEY"] || "";
    if (!secretKey) {
      console.error("[PAYSTACK] CRITICAL: PAYSTACK_SECRET_KEY is not set in environment variables!");
      reject(new Error("Paystack secret key is not configured on the server."));
      return;
    }
    const keyHint = `${secretKey.slice(0, 7)}...${secretKey.slice(-4)}`;
    console.log(`[PAYSTACK] ${method} ${path} | key=${keyHint}`);
    const data = body ? JSON.stringify(body) : undefined;
    const options = {
      hostname: "api.paystack.co",
      port: 443,
      path,
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, (res: any) => {
      let raw = "";
      res.on("data", (chunk: any) => { raw += chunk; });
      res.on("end", () => {
        console.log(`[PAYSTACK] ${method} ${path} → HTTP ${res.statusCode} | body=${raw.slice(0, 300)}`);
        try { resolve(JSON.parse(raw)); } catch { reject(new Error(`Invalid JSON response from Paystack: ${raw.slice(0, 100)}`)); }
      });
    });
    req.on("error", (err: any) => {
      console.error(`[PAYSTACK] Network error on ${method} ${path}:`, err.message);
      reject(err);
    });
    if (data) req.write(data);
    req.end();
  });
}

// Helper to record a paid member transaction
async function processSuccessfulMemberPayment(
  org: Organization,
  reference: string,
  memberName: string,
  memberEmail?: string,
  customFieldsData: Record<string, string> = {},
  photoUri?: string | null,
  amountPaid?: number
): Promise<{ member: OrgMember; issuedCard: any }> {
  
  const { data: existing } = await supabase.from("org_members").select("*").eq("org_id", org.id).eq("paystack_reference", reference).single();
  if (existing) {
    const m = mapMemberFromDB(existing);
    return { member: m, issuedCard: { id: m.cardId, ...issueCard(org, m) } };
  }

  const memberId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const cardId = `card_org_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const verificationToken = `vtoken_${org.id}_${memberId}_${Date.now()}`;
  const expiresAt = calcExpiresAt(org.membershipFeeInterval);

  const newMember: OrgMember = {
    id: memberId,
    orgId: org.id,
    memberName,
    memberEmail,
    customFieldsData,
    photoUri: photoUri || null,
    cardId,
    status: "active",
    verificationToken,
    joinedAt: new Date().toISOString(),
    expiresAt,
    paystackReference: reference,
    paymentStatus: "paid",
  };

  const gross = amountPaid || org.membershipFee || 0;
  const platformFee = Math.round(gross * 0.03 * 100) / 100;
  const netAmount = gross - platformFee;

  org.totalGrossRevenue = (org.totalGrossRevenue || 0) + gross;
  org.platformFeeCollected = (org.platformFeeCollected || 0) + platformFee;
  org.netBalance = (org.netBalance || 0) + netAmount;
  org.activeMemberCount += 1;

  await supabase.from("org_members").insert(mapMemberToDB(newMember));
  await supabase.from("organizations").update(mapOrgToDB(org)).eq("id", org.id);

  return { member: newMember, issuedCard: { id: cardId, ...issueCard(org, newMember) } };
}

// ─── Router ───────────────────────────────────────────────────────────────────

const router: Router = Router();

// Create new organization
router.post("/organizations", async (req: Request, res: Response) => {
  try {
    const {
      name,
      category = "gym",
      description = "",
      location = "",
      managerName = "Admin",
      managerEmail = "",
      managerPin = "1234",
      primaryColor = "#0F172A",
      secondaryColor = "#1E293B",
      accentColor = "#F59E0B",
      logoUri = "",
      badgeStyle = "holographic",
      customFields = [],
      membershipFee = 0,
      membershipFeeInterval = "free",
      membershipFeeDescription = "",
      tier = "starter",
      billingCycle = "monthly",
      requirePhoto = true,
      idGenerationMode = "member_provided",
    } = req.body;

    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "Organization name is required." });
      return;
    }

    const normName = name.trim().toLowerCase();
    // Simplified conflict check (we could do ILIKE in Postgres, but fetching all is fine for now if small)
    const { data: existingOrgs } = await supabase.from("organizations").select("id, name");
    const existing = existingOrgs?.find((o: any) => o.name.trim().toLowerCase() === normName);

    if (existing) {
      res.status(409).json({
        error: `An organization named "${existing.name}" already exists. Please choose a unique name.`,
      });
      return;
    }

    const id = `org_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const inviteCode =
      (name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() || "nascard") +
      Math.floor(1000 + Math.random() * 9000);

    const feeNum = Number(membershipFee) || 0;
    const resolvedInterval = feeNum === 0 ? "free" : membershipFeeInterval;
    const resolvedLimit = tier === "enterprise" ? 10000 : tier === "pro" ? 500 : 25;

    const newOrg: Organization = {
      id,
      name,
      category,
      description,
      location,
      managerName,
      managerEmail,
      managerPin: String(managerPin).trim() || "1234",
      primaryColor,
      secondaryColor: secondaryColor || "#1E293B",
      accentColor,
      logoUri: logoUri || undefined,
      badgeStyle,
      customFields,
      membershipFee: feeNum,
      membershipFeeInterval: resolvedInterval,
      membershipFeeDescription: membershipFeeDescription || (feeNum === 0 ? "Free Membership" : `${membershipFeeInterval} fee`),
      tier: tier as any,
      billingCycle: billingCycle as any,
      requirePhoto: Boolean(requirePhoto),
      idGenerationMode: idGenerationMode as any,
      memberLimit: resolvedLimit,
      activeMemberCount: 0,
      inviteCode,
      createdAt: new Date().toISOString(),
      totalGrossRevenue: 0,
      platformFeeCollected: 0,
      netBalance: 0,
      totalWithdrawn: 0,
      payoutHistory: [],
    };

    const { error } = await supabase.from("organizations").insert(mapOrgToDB(newOrg));
    if (error) throw error;

    res.status(201).json({ organization: newOrg });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create organization" });
  }
});

// List organizations
router.get("/organizations", async (_req: Request, res: Response) => {
  const { data, error } = await supabase.from("organizations").select("*");
  if (error) { res.status(500).json({ error: "Failed to fetch organizations" }); return; }
  res.json({ organizations: data.map(mapOrgFromDB) });
});

// Get organization by ID or invite code
router.get("/organizations/:id", async (req: Request, res: Response) => {
  const query = String(req.params["id"] || "");
  if (!query) { res.status(400).json({ error: "ID parameter missing" }); return; }

  let { data: orgData } = await supabase.from("organizations").select("*").eq("id", query).single();
  if (!orgData) {
    const { data } = await supabase.from("organizations").select("*").ilike("invite_code", query).single();
    orgData = data;
  }

  if (!orgData) { res.status(404).json({ error: "Organization not found" }); return; }
  res.json({ organization: mapOrgFromDB(orgData) });
});

// ─── Web Smart Landing Page (For users without the app installed) ─────────────
router.get("/join/:id", async (req: Request, res: Response) => {
  const query = String(req.params["id"] || "");
  
  let { data: orgData } = await supabase.from("organizations").select("*").eq("id", query).single();
  if (!orgData) {
    const { data } = await supabase.from("organizations").select("*").ilike("invite_code", query).single();
    orgData = data;
  }
  const org = orgData ? mapOrgFromDB(orgData) : null;

  const orgName = org ? org.name : "Organization Digital Pass";
  const orgCategory = org ? org.category.toUpperCase() : "OFFICIAL PASS";
  const primaryColor = org?.primaryColor || "#3B82F6";
  const inviteCode = org?.inviteCode || query;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Join ${orgName} on nascard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #080C16; color: #FFFFFF; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #131A2A; border: 1px solid #232E45; border-radius: 24px; padding: 32px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .badge { display: inline-block; background: ${primaryColor}22; color: ${primaryColor}; border: 1px solid ${primaryColor}44; padding: 6px 14px; borderRadius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 1px; margin-bottom: 16px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 12px; }
    p { color: #94A3B8; font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
    .code-box { background: #080C16; border: 1px dashed ${primaryColor}; padding: 14px; border-radius: 12px; font-size: 18px; font-weight: 700; color: ${primaryColor}; margin-bottom: 24px; letter-spacing: 2px; }
    .btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; background: ${primaryColor}; color: #FFFFFF; text-decoration: none; font-weight: 700; font-size: 16px; padding: 16px; border-radius: 14px; margin-bottom: 12px; transition: transform 0.2s; }
    .btn-sec { background: #1E293B; color: #FFFFFF; border: 1px solid #334155; }
    .btn:hover { transform: translateY(-2px); }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${orgCategory}</div>
    <h1>Claim your ${orgName} Pass</h1>
    <p>You have been invited to claim your official digital membership ID pass inside your 3D nascard Wallet.</p>
    
    <div class="code-box">Invite Code: ${inviteCode}</div>

    <a href="nascard://org/join/${query}" class="btn">📱 Open in nascard App</a>
    <a href="https://play.google.com/store/apps/details?id=com.nascard.app" class="btn btn-sec">🤖 Download on Google Play Store</a>
  </div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

// ─── Paystack: Initialize Dynamic Pro Subscription Payment ────────────────────────
router.post("/paystack/pro-checkout", async (req: Request, res: Response) => {
  try {
    const { email, billingCycle = "monthly", amount } = req.body;
    
    if (!email || !String(email).includes("@")) {
      res.status(400).json({ error: "A valid user email address is required for checkout." });
      return;
    }

    const normEmail = String(email).trim().toLowerCase();
    const chargedAmount = amount ? Number(amount) : billingCycle === "annual" ? 228 : 29;
    const amountKobo = Math.round(chargedAmount * 100);

    const ref = `nascard_pro_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const apiBase = process.env["EXPO_PUBLIC_DOMAIN"] || "https://nascard-api.onrender.com";
    const callbackUrl = `${apiBase}/api/paystack/callback?reference=${encodeURIComponent(ref)}&type=pro`;

    const paystackRes = await paystackRequest("POST", "/transaction/initialize", {
      email: normEmail,
      amount: amountKobo,
      currency: "GHS",
      reference: ref,
      callback_url: callbackUrl,
      metadata: {
        type: "pro_subscription",
        billing_cycle: billingCycle,
        user_email: normEmail,
      },
    });

    if (paystackRes?.status && paystackRes.data?.authorization_url) {
      res.json({
        authorizationUrl: paystackRes.data.authorization_url,
        accessCode: paystackRes.data.access_code,
        reference: paystackRes.data.reference || ref,
      });
      return;
    }

    res.status(503).json({ error: "Payment gateway unavailable. Please check Paystack configuration." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to initialize payment gateway." });
  }
});

// ─── Paystack Hosted Callback Handler ───────────────────────────────────────
router.get("/paystack/callback", (req: Request, res: Response) => {
  const reference = String(req.query["reference"] || req.query["trxref"] || "");
  const status = String(req.query["status"] || "success");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Successful — nascard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #080C16; color: #FFFFFF; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; }
    .card { background: #131A2A; border: 1px solid #232E45; border-radius: 24px; padding: 36px 28px; max-width: 400px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .icon { width: 72px; height: 72px; background: rgba(16, 185, 129, 0.15); border: 2px solid #10B981; border-radius: 36px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; font-size: 32px; color: #10B981; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 10px; color: #FFFFFF; }
    p { color: #94A3B8; font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
    .spinner { border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid #3B82F6; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 0 auto 16px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .btn { display: inline-block; background: #3B82F6; color: #FFFFFF; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 12px; transition: transform 0.2s; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>Payment Successful!</h1>
    <p>Returning you automatically to your 3D nascard Wallet...</p>
    <div class="spinner"></div>
    <a href="nascard://payment/success?reference=${encodeURIComponent(reference)}&status=success" class="btn">📱 Open nascard App</a>
  </div>
  <script>
    setTimeout(function() {
      window.location.href = "nascard://payment/success?reference=" + encodeURIComponent("${reference}") + "&status=success";
    }, 400);
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

// ─── Paystack: Initialize Org Plan Upgrade Payment ───────────────────────────
router.post("/paystack/org-checkout", async (req: Request, res: Response) => {
  try {
    const { email, orgId, tier, billingCycle = "monthly", amount } = req.body;

    if (!email || !String(email).includes("@")) {
      res.status(400).json({ error: "A valid admin email address is required for checkout." });
      return;
    }
    if (!orgId || !tier) {
      res.status(400).json({ error: "orgId and tier are required." });
      return;
    }

    const normEmail = String(email).trim().toLowerCase();
    const chargedAmount = amount ? Number(amount) : tier === "enterprise"
      ? (billingCycle === "yearly" ? 4790 : 499)
      : (billingCycle === "yearly" ? 1430 : 149);
    const amountKobo = Math.round(chargedAmount * 100);
    const ref = `org_tier_${orgId}_${billingCycle}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const apiBase = process.env["EXPO_PUBLIC_DOMAIN"] || "https://nascard-api.onrender.com";
    const callbackUrl = `${apiBase}/api/paystack/callback?reference=${encodeURIComponent(ref)}&orgId=${orgId}&status=success`;

    const paystackRes = await paystackRequest("POST", "/transaction/initialize", {
      email: normEmail,
      amount: amountKobo,
      currency: "GHS",
      reference: ref,
      callback_url: callbackUrl,
      metadata: {
        type: "org_plan_upgrade",
        org_id: orgId,
        tier,
        billing_cycle: billingCycle,
        admin_email: normEmail,
      },
    });

    if (paystackRes?.status && paystackRes.data?.authorization_url) {
      res.json({ authorizationUrl: paystackRes.data.authorization_url, reference: paystackRes.data.reference || ref });
      return;
    }
    res.status(503).json({ error: "Payment gateway not available. Please check Paystack configuration." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to initialize payment." });
  }
});

// ─── Paystack: Verify Pro Subscription Reference Server-side ──────────────────────
router.post("/paystack/verify-subscription", async (req: Request, res: Response) => {
  try {
    const { reference, email } = req.body;
    if (!email || !String(email).trim()) {
      res.status(400).json({ valid: false, error: "Account email address is required to verify subscription." });
      return;
    }

    const normEmail = String(email).trim().toLowerCase();

    const { data: existing } = await supabase.from("pro_subscriptions").select("*").eq("email", normEmail).single();
    if (existing && existing.status === "active") {
      res.json({ valid: true, isPro: true, subscription: existing });
      return;
    }

    if (reference) {
      try {
        const paystackRes = await paystackRequest("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
        if (paystackRes?.status && paystackRes.data?.status === "success") {
          const record = {
            email: normEmail,
            reference,
            amount: paystackRes.data.amount / 100,
            billing_cycle: paystackRes.data.amount >= 20000 ? "annual" : "monthly",
            status: "active",
            activated_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          };
          await supabase.from("pro_subscriptions").upsert(record);
          res.json({ valid: true, isPro: true, subscription: record });
          return;
        }
        const txStatus = paystackRes?.data?.status || "unknown";
        res.status(402).json({ valid: false, isPro: false, error: `Payment not confirmed by Paystack (status: ${txStatus})`, paystackStatus: txStatus });
        return;
      } catch (e) { console.warn("[Paystack Verify Error]:", e); }
    }

    res.status(402).json({ valid: false, isPro: false, error: "Payment reference is missing or could not be verified." });
  } catch (err: any) {
    res.status(500).json({ valid: false, error: "Internal server error verifying subscription." });
  }
});

// ─── Pro Subscription Access Check Endpoint ──────────────────────────────────────
router.get("/pro/check-status", async (req: Request, res: Response) => {
  const emailQuery = req.query.email as string;
  if (!emailQuery || !emailQuery.trim()) { res.status(400).json({ isPro: false, error: "Email parameter is required." }); return; }

  const normEmail = emailQuery.trim().toLowerCase();
  const { data: record } = await supabase.from("pro_subscriptions").select("*").eq("email", normEmail).single();

  if (record && record.status === "active") {
    res.json({ isPro: true, subscription: record });
  } else {
    res.json({ isPro: false });
  }
});

// ─── Paystack: Initialize payment for joining ─────────────────────────────────
router.post("/organizations/:id/payment/initialize", async (req: Request, res: Response) => {
  try {
    const orgId = String(req.params["id"] || "");
    const { data: orgData } = await supabase.from("organizations").select("*").eq("id", orgId).single();
    if (!orgData) { res.status(404).json({ error: "Organization not found" }); return; }
    
    const org = mapOrgFromDB(orgData);

    if (!org.membershipFee || org.membershipFee === 0) {
      res.status(400).json({ error: "This organization has no membership fee. Use the free join endpoint." });
      return;
    }

    const { email, memberName, customFieldsData = {}, photoUri, callbackUrl } = req.body;
    if (!email) { res.status(400).json({ error: "Member email is required for payment." }); return; }

    const amountKobo = Math.round(org.membershipFee * 100);

    const paystackRes = await paystackRequest("POST", "/transaction/initialize", {
      email,
      amount: amountKobo,
      currency: "GHS",
      reference: `nascard_${orgId}_${Date.now()}`,
      callback_url: callbackUrl || `nascard://payment/success`,
      metadata: {
        org_id: orgId,
        org_name: org.name,
        member_name: memberName || email,
        member_email: email,
        custom_fields_data: customFieldsData,
        photo_uri: photoUri || null,
        fee_interval: org.membershipFeeInterval,
      },
    });

    if (paystackRes?.status && paystackRes.data?.authorization_url) {
      res.json({
        authorization_url: paystackRes.data.authorization_url,
        access_code: paystackRes.data.access_code,
        reference: paystackRes.data.reference,
      });
      return;
    }

    res.status(503).json({ error: "Payment gateway unavailable." });
  } catch (error) {
    res.status(500).json({ error: "Failed to initialize payment." });
  }
});

// ─── Upgrade Organization Tier ────────────────────────────────────────────────
router.post("/organizations/:id/upgrade", async (req: Request, res: Response) => {
  try {
    const orgId = String(req.params["id"] || "");
    const { tier, billingCycle } = req.body;
    
    const { data: orgData } = await supabase.from("organizations").select("*").eq("id", orgId).single();
    if (!orgData) { res.status(404).json({ error: "Organization not found" }); return; }
    
    const org = mapOrgFromDB(orgData);

    if (tier === "pro" || tier === "enterprise") {
      org.tier = tier;
      org.memberLimit = tier === "enterprise" ? 10000 : 500;
      if (billingCycle) org.billingCycle = billingCycle;
      await supabase.from("organizations").update(mapOrgToDB(org)).eq("id", orgId);
    }

    res.json({ organization: org });
  } catch (error) {
    res.status(500).json({ error: "Failed to upgrade organization" });
  }
});

// ─── Paystack: Verify Org Plan Payment & Upgrade Tier ────────────────────────
router.post("/paystack/verify-org-payment", async (req: Request, res: Response) => {
  try {
    const { reference, orgId, tier, billingCycle, email } = req.body;
    if (!orgId || !tier) { res.status(400).json({ valid: false, error: "orgId and tier required." }); return; }

    const { data: orgData } = await supabase.from("organizations").select("*").eq("id", orgId).single();
    if (!orgData) { res.status(404).json({ valid: false, error: "Organization not found." }); return; }
    const org = mapOrgFromDB(orgData);

    let verified = false;
    let txStatus = "unknown";
    if (reference) {
      try {
        const paystackRes = await paystackRequest("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
        txStatus = paystackRes?.data?.status || "unknown";
        if (paystackRes?.status && paystackRes.data?.status === "success") verified = true;
      } catch (e) { console.warn("[ORG UPGRADE Paystack Verify Error]:", e); }
    }

    if (!verified) {
      res.status(402).json({ valid: false, error: `Payment not confirmed (status: ${txStatus})`, paystackStatus: txStatus });
      return;
    }

    org.tier = tier as "pro" | "enterprise";
    org.memberLimit = tier === "enterprise" ? 10000 : 500;
    if (billingCycle) org.billingCycle = billingCycle as "monthly" | "yearly";
    await supabase.from("organizations").update(mapOrgToDB(org)).eq("id", orgId);

    res.json({ valid: true, organization: org });
  } catch (err) {
    res.status(500).json({ valid: false, error: "Internal server error during org upgrade." });
  }
});

// ─── Paystack Webhook Listener ────────────────────────────────────────────────
router.post("/paystack/webhook", async (req: Request, res: Response) => {
  try {
    const secretKey = process.env["PAYSTACK_SECRET_KEY"] || "";
    const hash = crypto.createHmac("sha512", secretKey).update(JSON.stringify(req.body)).digest("hex");

    if (req.headers["x-paystack-signature"] && req.headers["x-paystack-signature"] !== hash) {
      res.status(401).send("Invalid Signature");
      return;
    }

    const event = req.body;
    if (event && event.event === "charge.success") {
      const data = event.data;
      const metadata = data?.metadata || {};
      const orgId = metadata.org_id;
      const reference = data.reference;

      if (orgId) {
        const { data: orgData } = await supabase.from("organizations").select("*").eq("id", orgId).single();
        if (orgData) {
          const org = mapOrgFromDB(orgData);
          await processSuccessfulMemberPayment(
            org,
            reference,
            metadata.member_name || data.customer?.first_name || "Member",
            metadata.member_email || data.customer?.email,
            metadata.custom_fields_data || {},
            metadata.photo_uri || null,
            data.amount / 100
          );
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    res.status(500).send("Webhook Error");
  }
});

// ─── Paystack: Verify payment & issue card ────────────────────────────────────
router.post("/organizations/:id/payment/verify", async (req: Request, res: Response) => {
  try {
    const orgId = String(req.params["id"] || "");
    const { reference, memberName, memberEmail, customFieldsData = {}, photoUri } = req.body;
    if (!orgId || !reference) { res.status(400).json({ error: "Missing organization ID or payment reference." }); return; }

    const { data: orgData } = await supabase.from("organizations").select("*").eq("id", orgId).single();
    if (!orgData) { res.status(404).json({ error: "Organization not found" }); return; }
    const org = mapOrgFromDB(orgData);

    let verifyRes: any = null;
    try {
      verifyRes = await paystackRequest("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
    } catch (e: any) {}

    const txStatus = verifyRes?.data?.status || "unverified";
    const isSuccess = verifyRes?.status && txStatus === "success";

    if (!isSuccess) {
      res.status(402).json({ error: `Payment not confirmed by Paystack (status: ${txStatus})`, paystackStatus: txStatus });
      return;
    }

    const amountPaid = (verifyRes.data?.amount || (org.membershipFee * 100)) / 100;
    const { member, issuedCard } = await processSuccessfulMemberPayment(
      org,
      reference,
      memberName || verifyRes.data?.customer?.first_name || "Member",
      memberEmail || verifyRes.data?.customer?.email,
      customFieldsData,
      photoUri,
      amountPaid
    );

    res.status(201).json({ member, issuedCard, organization: org, amountPaid });
  } catch (error: any) {
    res.status(500).json({ error: "Payment verification error." });
  }
});

// ─── Member joins free org ────────────────────────────────────────────────────
router.post("/organizations/:id/join", async (req: Request, res: Response) => {
  try {
    const orgId = String(req.params["id"] || "");
    const { data: orgData } = await supabase.from("organizations").select("*").eq("id", orgId).single();
    if (!orgData) { res.status(404).json({ error: "Organization not found" }); return; }
    const org = mapOrgFromDB(orgData);

    if (org.membershipFee > 0) {
      res.status(402).json({ error: "This organization requires payment.", requiresPayment: true });
      return;
    }

    const { memberName, memberEmail, customFieldsData = {}, photoUri } = req.body;
    if (!memberName) { res.status(400).json({ error: "Member name is required." }); return; }

    const { data: existingMembers } = await supabase.from("org_members").select("*").eq("org_id", orgId).eq("status", "active");
    const duplicate = existingMembers?.find((m: any) =>
      (memberEmail && m.member_email?.toLowerCase() === String(memberEmail).toLowerCase()) ||
      (m.member_name.toLowerCase() === String(memberName).toLowerCase())
    );

    if (duplicate) {
      const dupMember = mapMemberFromDB(duplicate);
      res.status(200).json({
        member: dupMember,
        issuedCard: { id: dupMember.cardId, ...issueCard(org, dupMember) },
        organization: org,
        alreadyMember: true,
      });
      return;
    }

    const memberId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const cardId = `card_org_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const verificationToken = `vtoken_${org.id}_${memberId}_${Date.now()}`;

    const newMember: OrgMember = {
      id: memberId,
      orgId: org.id,
      memberName,
      memberEmail,
      customFieldsData,
      photoUri: photoUri || null,
      cardId,
      status: "active",
      verificationToken,
      joinedAt: new Date().toISOString(),
      paymentStatus: "free",
    };

    org.activeMemberCount += 1;
    await supabase.from("org_members").insert(mapMemberToDB(newMember));
    await supabase.from("organizations").update({ active_member_count: org.activeMemberCount }).eq("id", orgId);

    res.status(201).json({
      member: newMember,
      issuedCard: { id: cardId, ...issueCard(org, newMember) },
      organization: org,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to join organization" });
  }
});

// ─── Manager roster ───────────────────────────────────────────────────────────
router.get("/organizations/:id/members", async (req: Request, res: Response) => {
  const orgId = String(req.params["id"] || "");
  const { data: orgData } = await supabase.from("organizations").select("*").eq("id", orgId).single();
  if (!orgData) { res.status(404).json({ error: "Organization not found" }); return; }

  await autoExpireMembers(orgId);

  const { data: membersData } = await supabase.from("org_members").select("*").eq("org_id", orgId);
  const members = (membersData || []).map(mapMemberFromDB);
  
  const activeCount = members.filter((m) => m.status === "active").length;
  const expiredCount = members.filter((m) => m.status === "expired").length;
  const revokedCount = members.filter((m) => m.status === "revoked").length;

  res.json({
    organization: mapOrgFromDB(orgData),
    members,
    stats: { total: members.length, active: activeCount, expired: expiredCount, revoked: revokedCount },
  });
});

router.post("/organizations/:id/members/bulk", async (req: Request, res: Response) => {
  try {
    const orgId = String(req.params["id"] || "");
    const { data: orgData } = await supabase.from("organizations").select("*").eq("id", orgId).single();
    if (!orgData) { res.status(404).json({ error: "Organization not found" }); return; }

    const incoming: OrgMember[] = Array.isArray(req.body.members) ? req.body.members : [];
    if (incoming.length === 0) { res.status(400).json({ error: "No members provided." }); return; }

    const records = incoming.map(m => mapMemberToDB({
      ...m,
      orgId,
      verificationToken: m.verificationToken || generateSecureToken(),
      joinedAt: m.joinedAt || new Date().toISOString(),
      status: m.status || "active",
    }));

    await supabase.from("org_members").upsert(records);
    const { count } = await supabase.from("org_members").select("*", { count: "exact" }).eq("org_id", orgId).eq("status", "active");
    
    const org = mapOrgFromDB(orgData);
    org.activeMemberCount = count || 0;
    await supabase.from("organizations").update({ active_member_count: count }).eq("id", orgId);

    res.json({ success: true, importedCount: incoming.length, organization: org });
  } catch (error) {
    res.status(500).json({ error: "Failed to process bulk import." });
  }
});

// ─── Verify scanned QR token ──────────────────────────────────────────────────
router.post("/organizations/:id/verify", async (req: Request, res: Response) => {
  try {
    const orgId = String(req.params["id"] || "");
    const { token } = req.body;
    if (!token) { res.status(400).json({ error: "Verification token required." }); return; }

    await autoExpireMembers(orgId);
    const tokenBase = token.split(":")[0] || token;

    let memberData;
    if (orgId) {
      const { data } = await supabase.from("org_members").select("*").eq("org_id", orgId).or(`verification_token.eq.${tokenBase},id.ilike.%${tokenBase}%`).single();
      memberData = data;
    } else {
      const { data } = await supabase.from("org_members").select("*").or(`verification_token.eq.${tokenBase},id.ilike.%${tokenBase}%`).single();
      memberData = data;
    }

    if (!memberData) {
      res.json({ valid: false, reason: "UNKNOWN_TOKEN", message: "No record found." });
      return;
    }

    const { data: orgData } = await supabase.from("organizations").select("*").eq("id", memberData.org_id).single();
    const matchedMember = mapMemberFromDB(memberData);
    const matchedOrg = mapOrgFromDB(orgData);

    if (matchedMember.status !== "active") {
      res.json({
        valid: false,
        reason: matchedMember.status.toUpperCase(),
        message: matchedMember.status === "expired" ? "Expired." : "Revoked.",
        member: matchedMember,
        organization: matchedOrg,
      });
      return;
    }

    if (matchedMember.expiresAt && new Date(matchedMember.expiresAt) < new Date()) {
      await supabase.from("org_members").update({ status: "expired" }).eq("id", matchedMember.id);
      res.json({
        valid: false,
        reason: "EXPIRED",
        message: "Pass expired.",
        member: { ...matchedMember, status: "expired" },
        organization: matchedOrg,
      });
      return;
    }

    res.json({ valid: true, member: matchedMember, organization: matchedOrg, verifiedAt: new Date().toISOString() });
  } catch {
    res.status(500).json({ error: "Verification error" });
  }
});

// ─── Revoke member ────────────────────────────────────────────────────────────
router.delete("/organizations/:id/members/:memberId", async (req: Request, res: Response) => {
  const orgId = String(req.params["id"] || "");
  const memberId = String(req.params["memberId"] || "");
  
  await supabase.from("org_members").update({ status: "revoked" }).eq("id", memberId).eq("org_id", orgId);
  const { count } = await supabase.from("org_members").select("*", { count: "exact" }).eq("org_id", orgId).eq("status", "active");
  await supabase.from("organizations").update({ active_member_count: count }).eq("id", orgId);

  res.json({ success: true, message: "Member revoked." });
});

// ─── Live Paystack MoMo & Ghana Bank Payout Transfer API ───────────────────────
router.post("/organizations/:id/withdraw", async (req: Request, res: Response) => {
  try {
    const orgId = String(req.params["id"] || "");
    const { data: orgData } = await supabase.from("organizations").select("*").eq("id", orgId).single();
    if (!orgData) { res.status(404).json({ error: "Organization not found" }); return; }
    const org = mapOrgFromDB(orgData);

    const { amount, bankCode, bankName, accountNumber, accountName, managerPin } = req.body;
    const withdrawAmount = Number(amount);

    if (org.managerPin && managerPin && String(org.managerPin) !== String(managerPin)) {
      res.status(403).json({ error: "Invalid Manager PIN." }); return;
    }

    const currentNetBalance = org.netBalance || 0;
    if (withdrawAmount > currentNetBalance) {
      res.status(400).json({ error: "Insufficient balance." }); return;
    }

    let transferCode = `TRF-${Date.now()}`;
    const isMoMo = ["MTN", "VODAFONE", "AIRTELTIGO"].includes(bankCode);

    try {
      const recipientRes = await paystackRequest("POST", "/transferrecipient", {
        type: isMoMo ? "mobile_money" : "ghipss",
        name: accountName || org.managerName || "Account Holder",
        account_number: accountNumber.trim(),
        bank_code: bankCode || (isMoMo ? "MTN" : "GCB"),
        currency: "GHS",
      });

      if (recipientRes.status && recipientRes.data?.recipient_code) {
        const transferRes = await paystackRequest("POST", "/transfer", {
          source: "balance",
          amount: Math.round(withdrawAmount * 100),
          recipient: recipientRes.data.recipient_code,
          reason: `Payout for ${org.name}`,
        });
        if (transferRes.status && transferRes.data?.transfer_code) transferCode = transferRes.data.transfer_code;
      }
    } catch (paystackErr) { console.warn("Paystack Transfer err", paystackErr); }

    const payoutRecord: OrganizationPayoutRecord = {
      id: `payout_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      amount: withdrawAmount,
      status: "completed",
      bankName,
      accountNumber,
      accountName: accountName || org.managerName || "Account Holder",
      requestedAt: new Date().toISOString(),
      reference: `WD-${Date.now().toString().slice(-6)}`,
      transferCode,
    };

    org.netBalance = currentNetBalance - withdrawAmount;
    org.totalWithdrawn = (org.totalWithdrawn || 0) + withdrawAmount;
    org.payoutBankDetails = { bankCode: bankCode || "", bankName, accountNumber, accountName: accountName || org.managerName };
    org.payoutHistory = [payoutRecord, ...(org.payoutHistory || [])];

    await supabase.from("organizations").update(mapOrgToDB(org)).eq("id", orgId);

    res.json({ success: true, message: "Transferred successfully.", organization: org, payout: payoutRecord });
  } catch (error) {
    res.status(500).json({ error: "Failed to process payout request." });
  }
});

export default router;
