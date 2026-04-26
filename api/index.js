module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'POST') {
    const keyCheck = process.env.GEMINI_API_KEY ? 'KEY_FOUND_LENGTH_' + process.env.GEMINI_API_KEY.length : 'NO_KEY_FOUND';
    return res.status(200).json({ status: 'ok', gemini: keyCheck });
  }

  // Quick test mode
  if (req.url && req.url.includes('test')) {
    try {
      var testUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + process.env.GEMINI_API_KEY;
      var testResp = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Return this exact JSON: [{"title":"Test Book","author":"Test Author","year":"2024"}]' }] }], generationConfig: { maxOutputTokens: 100 } })
      });
      var testRaw = await testResp.text();
      return res.status(200).json({ testResponse: testRaw });
    } catch(e) {
      return res.status(200).json({ testError: e.message });
    }
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
    var model = useSearch ? 'gemini-2.0-flash' : 'gemini-1.5-flash';
    var payload = {
      contents: geminiMessages,
      generationConfig: { maxOutputTokens: max_tokens }
    };
    if (useSearch) { payload.tools = [{ google_search: {} }]; }

    var apiKey = process.env.GEMINI_API_KEY;
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;

    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    var rawText = await response.text();

    if (!response.ok) {
      return res.status(200).json({
        content: [{ type: 'text', text: 'GEMINI_ERROR ' + response.status + ': ' + rawText }]
      });
    }

    var data = JSON.parse(rawText);
    var parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    var text = parts ? parts.filter(function(p){return p.text;}).map(function(p){return p.text;}).join('') : 'NO_CONTENT: ' + rawText;

    return res.status(200).json({ content: [{ type: 'text', text: text }] });

  } catch(e) {
    return res.status(200).json({ content: [{ type: 'text', text: 'CATCH_ERROR: ' + e.message }] });
  }
};
