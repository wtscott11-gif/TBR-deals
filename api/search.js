module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

  if (req.method === 'GET') {
    try {
      var listUrl = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey;
      var listResp = await fetch(listUrl);
      var listRaw = await listResp.text();
      return res.status(200).json({ models: listRaw });
    } catch(e) {
      return res.status(200).json({ error: e.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') { body = JSON.parse(body); }
    const messages = body.messages || [];
    const max_tokens = body.max_tokens || 1000;
    const tools = body.tools || [];

    const geminiMessages = messages.map(function(m) {
      var text = typeof m.content === 'string' ? m.content
        : Array.isArray(m.content) ? m.content.map(function(c){return c.text||'';}).join('')
        : String(m.content || '');
      return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: text }] };
    });

    var useSearch = tools.length > 0;
    var payload = {
      contents: geminiMessages,
      generationConfig: {
        maxOutputTokens: max_tokens,
        responseMimeType: useSearch ? undefined : 'application/json'
      }
    };
    if (useSearch) { payload.tools = [{ google_search: {} }]; }

    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    var rawText = await response.text();
    if (!response.ok) {
      return res.status(200).json({ content: [{ type: 'text', text: 'GEMINI_ERROR ' + response.status + ': ' + rawText }] });
    }

    var data = JSON.parse(rawText);

    // Extract all text parts including from search grounding
    var allParts = [];
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
      allParts = data.candidates[0].content.parts;
    }
    var text = allParts.filter(function(p){return p.text;}).map(function(p){return p.text;}).join('');

    // If empty, try to extract from grounding metadata
    if (!text && data.candidates && data.candidates[0]) {
      text = JSON.stringify(data.candidates[0]);
    }

    return res.status(200).json({ content: [{ type: 'text', text: text || 'NO_CONTENT' }] });

  } catch(e) {
    return res.status(200).json({ content: [{ type: 'text', text: 'CATCH_ERROR: ' + e.message }] });
  }
};
