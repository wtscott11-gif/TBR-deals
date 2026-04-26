export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  try {
    const { messages, max_tokens, tools } = req.body;

    const geminiMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof m.content === 'string'
        ? m.content
        : Array.isArray(m.content)
          ? m.content.map(c => c.text || '').join('')
          : String(m.content) }]
    }));

    const useSearch = !!(tools && tools.length > 0);
    const model = useSearch ? 'gemini-2.0-flash' : 'gemini-1.5-flash';

    const payload = {
      contents: geminiMessages,
      generationConfig: { maxOutputTokens: max_tokens || 1000 }
    };

    if (useSearch) {
      payload.tools = [{ google_search: {} }];
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      res.status(response.status).json({ error: err });
      return;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts
      ?.filter(p => p.text)
      ?.map(p => p.text)
      ?.join('') || '';

    res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
