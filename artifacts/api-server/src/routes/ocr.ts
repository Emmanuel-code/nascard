import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/ocr/scan-card", async (req, res) => {
  const { imageBase64, cardType } = req.body as {
    imageBase64?: string;
    cardType?: string;
  };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }

  const typeHint = cardType
    ? `The card is a ${cardType} card.`
    : "The card type is unknown.";

  const promptText = `You are a card OCR assistant. ${typeHint}

Extract the following fields from this card image and return ONLY a JSON object with these exact keys:
- "title": the card's name/title (e.g. "KNUST Student ID", "Ghana National ID", "Health Insurance Pass")
- "nameOnCard": the full name printed on the card (or empty string if not visible)
- "idNumber": the primary ID/card/membership number (or empty string if not visible)
- "expiryDate": expiry date in YYYY-MM-DD format (or empty string if not found)

Return ONLY the JSON object, no explanation, no markdown fences.`;

  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey.includes("REPLACE_WITH")) {
    res.json({ title: "Personal Card", nameOnCard: "", idNumber: "", expiryDate: "" });
    return;
  }

  // Primary: Gemini 2.5 Flash Vision OCR API
  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptText },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (geminiRes.ok) {
      const data = await geminiRes.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      let parsed: Record<string, string> = {};
      try {
        parsed = JSON.parse(cleanJson);
      } catch {
        parsed = {};
      }

      res.json({
        title: parsed.title || "Personal Card",
        nameOnCard: parsed.nameOnCard || "",
        idNumber: parsed.idNumber || "",
        expiryDate: parsed.expiryDate || "",
      });
      return;
    }
  } catch (gErr) {
    console.warn("Gemini OCR error fallback:", gErr);
  }

  res.json({ title: "Personal Card", nameOnCard: "", idNumber: "", expiryDate: "" });
});

export default router;
