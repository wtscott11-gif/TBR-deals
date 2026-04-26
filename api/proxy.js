module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { messages, max_tokens, tools } = req.body;

    const geminiMessages = messages.map(function(m) {
      var text = typeof m.content === 'string'
        ? m.content
        : Array.isArray(m.content)
          ? m.content.map(function(c) { return c.text || ''; }).join('')
          : String(m.content);
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: text }]
      };
    });

    var useSearch = !!(tools && tools.length > 0);
    var model = useSearch ? 'gemini-2.0-flash' : 'gemini-1.5-flash';

    var payload = {
      contents: geminiMessages,
      generationConfig: { maxOutputTokens: max_tokens || 1000 }
    };

    if (useSearch) {
      payload.tools = [{ google_search: {} }];
    }

    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + process.env.GEMINI_API_KEY;

    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    var rawText = await response.text();

    if (!response.ok) {
      res.status(200).json({
        content: [{ type: 'text', text: 'GEMINI_ERROR ' + response.status + ': ' + rawText }]
      });
      return;
    }

    var data = JSON.parse(rawText);
    var parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    var text = parts ? parts.filter(function(p) { return p.text; }).map(function(p) { return p.text; }).join('') : 'NO_TEXT: ' + rawText;

    res.status(200).json({
      content: [{ type: 'text', text: text }]
    });

  } catch (e) {
    res.status(200).json({
      content: [{ type: 'text', text: 'CATCH_ERROR: ' + e.message }]
    });
  }
};
