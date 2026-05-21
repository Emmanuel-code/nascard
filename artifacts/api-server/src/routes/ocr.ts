import { Router, type IRouter } from "express";
import OpenAI from "openai";

const router: IRouter = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a card OCR assistant. ${typeHint}

Extract the following fields from this card image and return ONLY a JSON object with these exact keys:
- "title": the card's name/title (e.g. "KNUST Student ID", "NHIS Health Card", "Accra Mall Loyalty Card")
- "nameOnCard": the full name printed on the card (or empty string if not visible)
- "idNumber": the primary ID/card/membership number (or empty string if not visible)
- "expiryDate": expiry date in YYYY-MM-DD format (or empty string if not found; if only month/year visible use last day of that month)

Return ONLY the JSON object, no explanation, no markdown fences.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "{}";

    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      req.log.warn({ raw }, "OCR response was not valid JSON");
      parsed = {};
    }

    res.json({
      title: parsed.title ?? "",
      nameOnCard: parsed.nameOnCard ?? "",
      idNumber: parsed.idNumber ?? "",
      expiryDate: parsed.expiryDate ?? "",
    });
  } catch (err: any) {
    req.log.error({ err }, "OCR scan failed");
    res.status(500).json({ error: "OCR scan failed. Please fill in details manually." });
  }
});

export default router;
