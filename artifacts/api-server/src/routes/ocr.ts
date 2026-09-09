import { Router, type IRouter } from "express";
import { requireApiKey } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/ocr/scan-card", requireApiKey, async (req, res) => {
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
    : "The card is a personal document/ID/membership card.";

  const promptText = `You are an AI card OCR assistant. ${typeHint}

Extract the following fields from this card image and return ONLY a JSON object with these exact keys:
- "title": the card's name/title (e.g. "Ghana National ID", "KNUST Student Pass", "Gym Membership Card", "Health Insurance Pass")
- "nameOnCard": the full name printed on the card (or empty string if not visible)
- "idNumber": the primary ID/card/membership number (or empty string if not visible)
- "expiryDate": expiry date in YYYY-MM-DD format (or empty string if not found)

Return ONLY the JSON object, no explanation, no markdown fences.`;

  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // 1. Try Gemini Vision API (models: gemini-1.5-flash, gemini-2.0-flash)
  if (geminiKey && !geminiKey.includes("REPLACE_WITH")) {
    const modelsToTry = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];
    for (const model of modelsToTry) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
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
          const data: any = await geminiRes.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
          const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
          let parsed: Record<string, string> = {};
          try {
            parsed = JSON.parse(cleanJson);
          } catch {
            parsed = {};
          }

          res.json({
            success: true,
            title: parsed.title || "Personal Card",
            nameOnCard: parsed.nameOnCard || "",
            idNumber: parsed.idNumber || "",
            expiryDate: parsed.expiryDate || "",
          });
          return;
        }
      } catch (gErr) {
        console.warn(`Gemini OCR model ${model} failed, trying next:`, gErr);
      }
    }
  }

  // 2. Try OpenAI Vision API
  if (openaiKey && !openaiKey.includes("REPLACE_WITH")) {
    try {
      const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: promptText },
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 300,
        }),
      });

      if (openAiRes.ok) {
        const data: any = await openAiRes.json();
        const rawContent = data.choices?.[0]?.message?.content || "{}";
        const parsed = JSON.parse(rawContent);

        res.json({
          success: true,
          title: parsed.title || "Personal Card",
          nameOnCard: parsed.nameOnCard || "",
          idNumber: parsed.idNumber || "",
          expiryDate: parsed.expiryDate || "",
        });
        return;
      }
    } catch (oErr) {
      console.warn("OpenAI OCR error:", oErr);
    }
  }

  // 3. Fail gracefully when OCR engines are unconfigured or unavailable
  res.status(503).json({
    success: false,
    error: "AI Vision OCR is not configured or unavailable. Please enter details manually.",
    title: "",
    nameOnCard: "",
    idNumber: "",
    expiryDate: "",
  });
});

export default router;
