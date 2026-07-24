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

  const promptText = `You are a card OCR assistant. ${typeHint}

Extract the following fields from this card image and return ONLY a JSON object with these exact keys:
- "title": the card's name/title (e.g. "KNUST Student ID", "Ghana National ID", "Health Insurance Pass")
- "nameOnCard": the full name printed on the card (or empty string if not visible)
- "idNumber": the primary ID/card/membership number (or empty string if not visible)
- "expiryDate": expiry date in YYYY-MM-DD format (or empty string if not found)

Return ONLY the JSON object, no explanation, no markdown fences.`;

  // 1. Try Gemini 2.5 Flash Vision if GEMINI_API_KEY is configured
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
        const parsed = JSON.parse(cleanJson);

        res.json({
          title: parsed.title ?? "",
          nameOnCard: parsed.nameOnCard ?? "",
          idNumber: parsed.idNumber ?? "",
          expiryDate: parsed.expiryDate ?? "",
        });
        return;
      }
    } catch (gErr) {
      console.warn("Gemini OCR fallback note:", gErr);
    }
  }

  // 2. Fallback to OpenAI GPT-4o if OPENAI_API_KEY is configured
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
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
    const cleanJson = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      parsed = {};
    }

    res.json({
      title: parsed.title ?? "",
      nameOnCard: parsed.nameOnCard ?? "",
      idNumber: parsed.idNumber ?? "",
      expiryDate: parsed.expiryDate ?? "",
    });
  } catch (err: any) {
    res.status(500).json({ error: "OCR scan failed. Please fill in details manually." });
  }
});

export default router;
