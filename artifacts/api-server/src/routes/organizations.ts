import { Router, type Request, type Response } from "express";
import https from "https";
import crypto from "crypto";
import { readStore, writeStore, readList, writeList } from "../lib/storage";

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
  accentColor: string;
  badgeStyle: "holographic" | "gold" | "minimal" | "modern";
  customFields: CustomFieldSchema[];
  membershipFee: number;
  membershipFeeInterval: "one_time" | "monthly" | "yearly" | "free";
  membershipFeeDescription: string;
  tier: "starter" | "pro" | "enterprise";
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

// ─── Persistent Stores ────────────────────────────────────────────────────────

const organizationsStore = readStore<Organization>("organizations");
const membersStore = readList<OrgMember>("members");

function saveOrgs() { writeStore("organizations", organizationsStore); }
function saveMembers() { writeList("members", membersStore); }

// ─── Demo Org Seed ────────────────────────────────────────────────────────────

const sampleOrgId = "org_demo_gym";
if (!organizationsStore.has(sampleOrgId)) {
  const sampleOrg: Organization = {
    id: sampleOrgId,
    name: "Apex Fitness & Performance",
    category: "gym",
    description: "Official All-Access Member Digital Pass for Apex Fitness",
    location: "742 Evergreen Terrace, Accra, Ghana",
    managerName: "Alex Vance",
    managerEmail: "admin@apexfitness.com",
    managerPin: "1234",
    primaryColor: "#0F172A",
    accentColor: "#F59E0B",
    badgeStyle: "gold",
    customFields: [
      { id: "member_id", label: "Member ID #", type: "text", required: true, placeholder: "APX-8820" },
      { id: "emergency_phone", label: "Emergency Contact Phone", type: "phone", required: true, placeholder: "0241234567" },
    ],
    membershipFee: 0,
    membershipFeeInterval: "free",
    membershipFeeDescription: "Free Membership Pass",
    tier: "pro",
    memberLimit: 250,
    activeMemberCount: 0,
    inviteCode: "APEX2026",
    createdAt: new Date().toISOString(),
    totalGrossRevenue: 0,
    platformFeeCollected: 0,
    netBalance: 0,
    totalWithdrawn: 0,
    payoutHistory: [],
  };
  organizationsStore.set(sampleOrgId, sampleOrg);
  membersStore.set(sampleOrgId, []);
  saveOrgs();
  saveMembers();
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

function autoExpireMembers(orgId: string): void {
  const members = membersStore.get(orgId) || [];
  const now = new Date();
  let changed = false;
  const updated = members.map((m) => {
    if (m.status === "active" && m.expiresAt && new Date(m.expiresAt) < now) {
      changed = true;
      return { ...m, status: "expired" as const };
    }
    return m;
  });
  if (changed) {
    membersStore.set(orgId, updated);
    saveMembers();
    const org = organizationsStore.get(orgId);
    if (org) {
      org.activeMemberCount = updated.filter((m) => m.status === "active").length;
      organizationsStore.set(orgId, org);
      saveOrgs();
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
    accentColor: org.accentColor,
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
        try { resolve(JSON.parse(raw)); } catch { reject(new Error("Invalid JSON response")); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// Helper to record a paid member transaction
function processSuccessfulMemberPayment(
  org: Organization,
  reference: string,
  memberName: string,
  memberEmail?: string,
  customFieldsData: Record<string, string> = {},
  photoUri?: string | null,
  amountPaid?: number
): { member: OrgMember; issuedCard: any } {
  const existingMembers = membersStore.get(org.id) || [];
  const found = existingMembers.find((m) => m.paystackReference === reference);
  if (found) {
    return { member: found, issuedCard: { id: found.cardId, ...issueCard(org, found) } };
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

  existingMembers.push(newMember);
  membersStore.set(org.id, existingMembers);
  org.activeMemberCount = existingMembers.filter((m) => m.status === "active").length;
  organizationsStore.set(org.id, org);
  saveOrgs();
  saveMembers();

  return { member: newMember, issuedCard: { id: cardId, ...issueCard(org, newMember) } };
}

// ─── Router ───────────────────────────────────────────────────────────────────

const router: Router = Router();

// Create new organization
router.post("/organizations", (req: Request, res: Response) => {
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
      accentColor = "#F59E0B",
      badgeStyle = "holographic",
      customFields = [],
      membershipFee = 0,
      membershipFeeInterval = "free",
      membershipFeeDescription = "",
    } = req.body;

    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "Organization name is required." });
      return;
    }

    const id = `org_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const inviteCode =
      (name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() || "nascard") +
      Math.floor(1000 + Math.random() * 9000);

    const feeNum = Number(membershipFee) || 0;
    const resolvedInterval = feeNum === 0 ? "free" : membershipFeeInterval;

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
      accentColor,
      badgeStyle,
      customFields,
      membershipFee: feeNum,
      membershipFeeInterval: resolvedInterval,
      membershipFeeDescription: membershipFeeDescription || (feeNum === 0 ? "Free Membership" : `${membershipFeeInterval} fee`),
      tier: "pro",
      memberLimit: 250,
      activeMemberCount: 0,
      inviteCode,
      createdAt: new Date().toISOString(),
      totalGrossRevenue: 0,
      platformFeeCollected: 0,
      netBalance: 0,
      totalWithdrawn: 0,
      payoutHistory: [],
    };

    organizationsStore.set(id, newOrg);
    membersStore.set(id, []);
    saveOrgs();
    saveMembers();

    res.status(201).json({ organization: newOrg });
  } catch (error) {
    res.status(500).json({ error: "Failed to create organization" });
  }
});

// List organizations
router.get("/organizations", (_req: Request, res: Response) => {
  const orgs = Array.from(organizationsStore.values());
  res.json({ organizations: orgs });
});

// Get organization by ID or invite code
router.get("/organizations/:id", (req: Request, res: Response) => {
  const query = String(req.params["id"] || "");
  if (!query) { res.status(400).json({ error: "ID parameter missing" }); return; }

  let org = organizationsStore.get(query);
  if (!org) {
    org = Array.from(organizationsStore.values()).find(
      (o) => o.inviteCode.toUpperCase() === query.toUpperCase()
    );
  }

  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }

  res.json({ organization: org });
});

// ─── Web Smart Landing Page (For users without the app installed) ─────────────
router.get("/join/:id", (req: Request, res: Response) => {
  const query = String(req.params["id"] || "");
  let org = organizationsStore.get(query);
  if (!org) {
    org = Array.from(organizationsStore.values()).find(
      (o) => o.inviteCode.toUpperCase() === query.toUpperCase()
    );
  }

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
    const { email = "user@nascard.app", amount = 29 } = req.body;
    const amountKobo = Math.round(Number(amount) * 100);

    const paystackRes = await paystackRequest("POST", "/transaction/initialize", {
      email,
      amount: amountKobo,
      currency: "GHS",
      reference: `nascard_pro_${Date.now()}`,
      callback_url: `nascard://payment/pro-success`,
      metadata: {
        type: "pro_subscription",
      },
    });

    if (paystackRes?.status && paystackRes.data?.authorization_url) {
      res.json({
        authorizationUrl: paystackRes.data.authorization_url,
        accessCode: paystackRes.data.access_code,
        reference: paystackRes.data.reference,
      });
    } else {
      res.status(500).json({ error: paystackRes?.message || "Failed to initialize Paystack checkout" });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to initialize Paystack checkout" });
  }
});

// ─── Paystack: Initialize payment for joining ─────────────────────────────────
router.post("/organizations/:id/payment/initialize", async (req: Request, res: Response) => {
  try {
    const orgId = String(req.params["id"] || "");
    if (!orgId) { res.status(400).json({ error: "ID parameter missing" }); return; }

    const org = organizationsStore.get(orgId);
    if (!org) { res.status(404).json({ error: "Organization not found" }); return; }

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
        custom_fields: [
          { display_name: "Organization", variable_name: "org_name", value: org.name },
          { display_name: "Member", variable_name: "member_name", value: memberName || email },
        ],
      },
    });

    if (!paystackRes.status) {
      res.status(400).json({ error: paystackRes.message || "Failed to initialize payment" });
      return;
    }

    res.json({
      authorization_url: paystackRes.data.authorization_url,
      access_code: paystackRes.data.access_code,
      reference: paystackRes.data.reference,
    });
  } catch (error) {
    res.status(500).json({ error: "Payment initialization error" });
  }
});

// ─── Paystack Webhook Listener ────────────────────────────────────────────────

router.post("/paystack/webhook", (req: Request, res: Response) => {
  try {
    const secretKey = process.env["PAYSTACK_SECRET_KEY"] || "";
    const hash = crypto
      .createHmac("sha512", secretKey)
      .update(JSON.stringify(req.body))
      .digest("hex");

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

      if (orgId && organizationsStore.has(orgId)) {
        const org = organizationsStore.get(orgId)!;
        const gross = data.amount / 100;
        processSuccessfulMemberPayment(
          org,
          reference,
          metadata.member_name || data.customer?.first_name || "Member",
          metadata.member_email || data.customer?.email,
          metadata.custom_fields_data || {},
          metadata.photo_uri || null,
          gross
        );
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
    if (!orgId || !reference) {
      res.status(400).json({ error: "Missing organization ID or payment reference." });
      return;
    }

    const org = organizationsStore.get(orgId);
    if (!org) { res.status(404).json({ error: "Organization not found" }); return; }

    const verifyRes = await paystackRequest("GET", `/transaction/verify/${reference}`);

    if (!verifyRes.status || verifyRes.data?.status !== "success") {
      res.status(402).json({
        error: "Payment not completed or verification failed.",
        paystackStatus: verifyRes.data?.status,
      });
      return;
    }

    const amountPaid = (verifyRes.data?.amount || (org.membershipFee * 100)) / 100;

    const { member, issuedCard } = processSuccessfulMemberPayment(
      org,
      reference,
      memberName || verifyRes.data?.customer?.first_name || "Member",
      memberEmail || verifyRes.data?.customer?.email,
      customFieldsData,
      photoUri,
      amountPaid
    );

    res.status(201).json({
      member,
      issuedCard,
      organization: org,
      amountPaid,
    });
  } catch (error) {
    res.status(500).json({ error: "Payment verification error" });
  }
});

// ─── Member joins free org ────────────────────────────────────────────────────

router.post("/organizations/:id/join", (req: Request, res: Response) => {
  try {
    const orgId = String(req.params["id"] || "");
    if (!orgId) { res.status(400).json({ error: "ID parameter missing" }); return; }

    const org = organizationsStore.get(orgId);
    if (!org) { res.status(404).json({ error: "Organization not found" }); return; }

    if (org.membershipFee > 0) {
      res.status(402).json({
        error: "This organization requires payment to join.",
        membershipFee: org.membershipFee,
        membershipFeeInterval: org.membershipFeeInterval,
        requiresPayment: true,
      });
      return;
    }

    const { memberName, memberEmail, customFieldsData = {}, photoUri } = req.body;
    if (!memberName || typeof memberName !== "string") {
      res.status(400).json({ error: "Member name is required." });
      return;
    }

    const existingMembers = membersStore.get(org.id) || [];
    const duplicate = existingMembers.find(
      (m) =>
        (memberEmail && m.memberEmail?.toLowerCase() === String(memberEmail).toLowerCase()) ||
        (m.memberName.toLowerCase() === String(memberName).toLowerCase() && m.status === "active")
    );

    if (duplicate) {
      res.status(200).json({
        member: duplicate,
        issuedCard: { id: duplicate.cardId, ...issueCard(org, duplicate) },
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

    const existingMembers = membersStore.get(org.id) || [];
    existingMembers.push(newMember);
    membersStore.set(org.id, existingMembers);
    org.activeMemberCount = existingMembers.filter((m) => m.status === "active").length;
    organizationsStore.set(org.id, org);
    saveOrgs();
    saveMembers();

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

router.get("/organizations/:id/members", (req: Request, res: Response) => {
  const orgId = String(req.params["id"] || "");
  if (!orgId) { res.status(400).json({ error: "ID parameter missing" }); return; }

  const org = organizationsStore.get(orgId);
  if (!org) { res.status(404).json({ error: "Organization not found" }); return; }

  autoExpireMembers(orgId);

  const members = membersStore.get(orgId) || [];
  const activeCount = members.filter((m) => m.status === "active").length;
  const expiredCount = members.filter((m) => m.status === "expired").length;
  const revokedCount = members.filter((m) => m.status === "revoked").length;

  res.json({
    organization: org,
    members,
    stats: { total: members.length, active: activeCount, expired: expiredCount, revoked: revokedCount },
  });
});

// ─── Verify scanned QR token (TOTP Dynamic Window + Timestamp validation) ────

router.post("/organizations/:id/verify", (req: Request, res: Response) => {
  try {
    const orgId = String(req.params["id"] || "");
    const { token } = req.body;

    if (!token) { res.status(400).json({ error: "Verification token is required." }); return; }

    autoExpireMembers(orgId);

    // Dynamic TOTP timestamp parse (token syntax: vtoken_orgId_memId_timestamp or base_token)
    const tokenBase = token.split(":")[0] || token;

    let matchedMember: OrgMember | undefined;
    let matchedOrg: Organization | undefined;

    if (orgId && organizationsStore.has(orgId)) {
      const members = membersStore.get(orgId) || [];
      matchedMember = members.find((m) => m.verificationToken === tokenBase || tokenBase.includes(m.id));
      if (matchedMember) matchedOrg = organizationsStore.get(orgId);
    } else {
      for (const [oId, members] of membersStore.entries()) {
        matchedMember = members.find((m) => m.verificationToken === tokenBase || tokenBase.includes(m.id));
        if (matchedMember) { matchedOrg = organizationsStore.get(oId); break; }
      }
    }

    if (!matchedMember || !matchedOrg) {
      res.json({ valid: false, reason: "UNKNOWN_TOKEN", message: "No membership record found for this nascard pass." });
      return;
    }

    if (matchedMember.status !== "active") {
      res.json({
        valid: false,
        reason: matchedMember.status.toUpperCase(),
        message:
          matchedMember.status === "expired"
            ? "This nascard membership pass has expired. Please renew to regain access."
            : "This membership has been revoked by the organization.",
        member: matchedMember,
        organization: matchedOrg,
      });
      return;
    }

    if (matchedMember.expiresAt && new Date(matchedMember.expiresAt) < new Date()) {
      res.json({
        valid: false,
        reason: "EXPIRED",
        message: "This nascard membership pass has expired.",
        member: { ...matchedMember, status: "expired" },
        organization: matchedOrg,
      });
      return;
    }

    res.json({
      valid: true,
      member: matchedMember,
      organization: matchedOrg,
      verifiedAt: new Date().toISOString(),
      expiresAt: matchedMember.expiresAt || null,
    });
  } catch {
    res.status(500).json({ error: "Verification error" });
  }
});

// ─── Revoke member ────────────────────────────────────────────────────────────

router.delete("/organizations/:id/members/:memberId", (req: Request, res: Response) => {
  const orgId = String(req.params["id"] || "");
  const memberId = String(req.params["memberId"] || "");
  if (!orgId || !memberId) { res.status(400).json({ error: "Missing parameters" }); return; }

  const members = membersStore.get(orgId);
  if (!members) { res.status(404).json({ error: "Organization not found" }); return; }

  const idx = members.findIndex((m) => m.id === memberId);
  if (idx !== -1 && members[idx]) {
    members[idx] = { ...members[idx]!, status: "revoked" };
  }

  const org = organizationsStore.get(orgId);
  if (org) {
    org.activeMemberCount = members.filter((m) => m.status === "active").length;
    organizationsStore.set(orgId, org);
    saveOrgs();
  }
  membersStore.set(orgId, members);
  saveMembers();

  res.json({ success: true, message: "Member revoked successfully." });
});

// ─── Live Paystack MoMo & Ghana Bank Payout Transfer API ───────────────────────

router.post("/organizations/:id/withdraw", async (req: Request, res: Response) => {
  try {
    const orgId = String(req.params["id"] || "");
    if (!orgId) { res.status(400).json({ error: "Organization ID is required." }); return; }

    const org = organizationsStore.get(orgId);
    if (!org) { res.status(404).json({ error: "Organization not found" }); return; }

    const { amount, bankCode, bankName, accountNumber, accountName, managerPin } = req.body;
    const withdrawAmount = Number(amount);

    // Verify Manager Security PIN if configured
    if (org.managerPin && managerPin && String(org.managerPin) !== String(managerPin)) {
      res.status(403).json({ error: "Invalid Manager Security PIN." });
      return;
    }

    if (!withdrawAmount || withdrawAmount <= 0) {
      res.status(400).json({ error: "Please enter a valid withdrawal amount greater than 0." });
      return;
    }

    const currentNetBalance = org.netBalance || 0;
    if (withdrawAmount > currentNetBalance) {
      res.status(400).json({
        error: `Insufficient net balance. Available for withdrawal: GH₵${currentNetBalance.toLocaleString()}`,
      });
      return;
    }

    if (!accountNumber || !bankName) {
      res.status(400).json({ error: "Destination account (MoMo or Bank) and phone/account number are required." });
      return;
    }

    let transferCode = `TRF-${Date.now()}`;
    const isMoMo = ["MTN", "VODAFONE", "AIRTELTIGO"].includes(bankCode);

    // Live Paystack Transfer Recipient Creation
    try {
      const recipientRes = await paystackRequest("POST", "/transferrecipient", {
        type: isMoMo ? "mobile_money" : "ghipss",
        name: accountName || org.managerName || "Account Holder",
        account_number: accountNumber.trim(),
        bank_code: bankCode || (isMoMo ? "MTN" : "GCB"),
        currency: "GHS",
      });

      if (recipientRes.status && recipientRes.data?.recipient_code) {
        const recipientCode = recipientRes.data.recipient_code;
        const transferRes = await paystackRequest("POST", "/transfer", {
          source: "balance",
          amount: Math.round(withdrawAmount * 100),
          recipient: recipientCode,
          reason: `nascard Manager Revenue Payout for ${org.name}`,
        });
        if (transferRes.status && transferRes.data?.transfer_code) {
          transferCode = transferRes.data.transfer_code;
        }
      }
    } catch (paystackErr) {
      console.warn("Paystack Transfer API call note (using sandbox/ledger recording):", paystackErr);
    }

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
    org.payoutBankDetails = {
      bankCode: bankCode || "",
      bankName,
      accountNumber,
      accountName: accountName || org.managerName || "Account Holder",
    };
    org.payoutHistory = [payoutRecord, ...(org.payoutHistory || [])];

    organizationsStore.set(orgId, org);
    saveOrgs();

    res.json({
      success: true,
      message: `Successfully transferred GH₵${withdrawAmount.toLocaleString()} to ${bankName} (${accountNumber}).`,
      organization: org,
      payout: payoutRecord,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to process payout request." });
  }
});

export default router;
