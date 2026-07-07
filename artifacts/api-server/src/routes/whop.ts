import { Router } from 'express';
import { getWhopClient } from '../whopClient';

const router = Router();

const COMPANY_ID = process.env.WHOP_COMPANY_ID ?? 'biz_HRId8MA5nrVXPq';
const PLAN_ID = process.env.WHOP_PLAN_ID ?? 'plan_4x6V5EzDcXzH2';
const PRODUCT_ID = 'prod_lHG2IbQHWRDdj';

// POST /api/whop/checkout — create a Whop-hosted checkout session
router.post('/whop/checkout', async (req, res) => {
  try {
    const whop = await getWhopClient();

    const domains = process.env.REPLIT_DOMAINS?.split(',') ?? [];
    const baseUrl = domains[0] ? `https://${domains[0]}` : 'http://localhost:80';
    const redirectUrl = `${baseUrl}/api/whop/checkout-success`;

    const config = await whop.checkoutConfigurations.create({
      plan_id: PLAN_ID,
      redirect_url: redirectUrl,
    } as any);

    const purchaseUrl = (config as any).purchase_url ?? `https://whop.com/checkout/${PLAN_ID}`;
    return res.json({ purchaseUrl });
  } catch (err: any) {
    req.log.error({ err }, 'whop checkout error');
    // Fallback: direct plan checkout URL always works
    return res.json({ purchaseUrl: `https://whop.com/checkout/${PLAN_ID}` });
  }
});

// GET /api/whop/checkout-success — Whop redirects here after payment
router.get('/whop/checkout-success', (_req, res) => {
  const domains = process.env.REPLIT_DOMAINS?.split(',') ?? [];
  const baseUrl = domains[0] ? `https://${domains[0]}` : '';
  res.redirect(`${baseUrl}/?pro=1`);
});

// GET /api/whop/check-access?email=xxx — verify if a user has active Pro
router.get('/whop/check-access', async (req, res) => {
  const email = req.query.email as string | undefined;
  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  try {
    const whop = await getWhopClient();

    // List memberships for this company then check by email
    const result = await (whop as any).memberships.list({
      company_id: COMPANY_ID,
    });

    const data: any[] = result?.data ?? [];
    const hasPro = data.some(
      (m: any) =>
        m.user?.email?.toLowerCase() === email.toLowerCase() &&
        m.status === 'active' &&
        m.product?.id === PRODUCT_ID,
    );

    return res.json({ hasPro });
  } catch (err: any) {
    req.log.error({ err }, 'whop check-access error');
    return res.json({ hasPro: false });
  }
});

// GET /api/whop/plan — return plan details for the paywall UI
router.get('/whop/plan', async (_req, res) => {
  return res.json({
    planId: PLAN_ID,
    price: 4.99,
    currency: 'usd',
    billingPeriod: 30,
    title: 'CardVault Pro',
    features: [
      'Unlimited cards (free: up to 5)',
      'AES-256 encrypted backup & restore',
      'Biometric / PIN app lock',
      '3D Wallet with holographic flip',
      'Location-aware card suggestions',
      'Expiry notifications',
      '60-second verification QR',
      'Live barcode scanner',
      'OCR auto-fill (GPT-4o Vision)',
    ],
  });
});

export default router;
