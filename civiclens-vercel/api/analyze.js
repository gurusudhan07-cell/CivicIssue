// Vercel serverless function: live AI issue detection with Google Gemini.
// The key is read from the Vercel environment variable GEMINI_API_KEY. Never paste it in this file.
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.GEMINI_API_KEY; // <-- set this in Vercel > Settings > Environment Variables
  if (!key) return res.status(503).json({ error: "GEMINI_API_KEY not set" });
  try {
    const { image, categories } = req.body || {};
    if (!image) return res.status(400).json({ error: "image missing" });
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const prompt = `You triage citizen photos of city problems. Decide if this photo shows a civic issue. Allowed issue types: ${(categories || []).join(", ")}. Reply with ONE JSON object: {"civic": true or false, "issue": one allowed type, "severity": 1 to 5 (5 = dangerous or blocking), "confidence": 0 to 100, "summary": one short sentence describing what you see}. If it is not a civic issue, set civic to false.`;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: "image/jpeg", data: image } }, { text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
      })
    });
    if (!r.ok) return res.status(502).json({ error: "gemini request failed" });
    const j = await r.json();
    const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
    const txt = parts.map(p => p.text || "").join("");
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return res.status(502).json({ error: "bad model reply" });
    return res.status(200).json(JSON.parse(m[0]));
  } catch (e) {
    return res.status(500).json({ error: "analysis failed" });
  }
};
