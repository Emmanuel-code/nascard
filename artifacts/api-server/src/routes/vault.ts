import { Router, type Request, type Response } from "express";
import { requireApiKey } from "../middlewares/auth";

const router = Router();

// In-memory encrypted cloud vault store keyed by normalized email
const cloudVaultStore = new Map<
  string,
  {
    email: string;
    vaultData: any;
    totalCards: number;
    updatedAt: string;
  }
>();

// POST /api/vault/sync — Upload encrypted cloud vault snapshot
router.post("/vault/sync", requireApiKey, (req: Request, res: Response) => {
  const { email, vaultData, totalCards } = req.body as {
    email?: string;
    vaultData?: any;
    totalCards?: number;
  };

  if (!email || !email.trim()) {
    res.status(400).json({ error: "Registered email address is required for cloud sync." });
    return;
  }

  if (!vaultData) {
    res.status(400).json({ error: "vaultData payload is required." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const entry = {
    email: normalizedEmail,
    vaultData,
    totalCards: totalCards || (Array.isArray(vaultData?.cards) ? vaultData.cards.length : 0),
    updatedAt: new Date().toISOString(),
  };

  cloudVaultStore.set(normalizedEmail, entry);

  console.log(`[CloudVault] Synced ${entry.totalCards} cards for ${normalizedEmail}`);

  res.json({
    success: true,
    message: "Cloud vault synchronized successfully.",
    totalCards: entry.totalCards,
    updatedAt: entry.updatedAt,
  });
});

// GET /api/vault/restore — Restore cloud vault snapshot by email
router.get("/vault/restore", (req: Request, res: Response) => {
  const emailQuery = req.query.email as string;

  if (!emailQuery || !emailQuery.trim()) {
    res.status(400).json({ error: "Email query parameter is required." });
    return;
  }

  const normalizedEmail = emailQuery.trim().toLowerCase();
  const entry = cloudVaultStore.get(normalizedEmail);

  if (!entry) {
    res.status(444).json({
      found: false,
      error: `No cloud vault backup found for ${normalizedEmail}. Make sure you synced your vault on your previous device.`,
    });
    return;
  }

  res.json({
    found: true,
    email: entry.email,
    vaultData: entry.vaultData,
    totalCards: entry.totalCards,
    updatedAt: entry.updatedAt,
  });
});

export default router;
