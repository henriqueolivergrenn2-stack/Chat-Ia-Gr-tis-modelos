const { send, readJson } = require('../lib/http');
const { getGroqKey } = require('../lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });

  const key = await getGroqKey();
  if (!key) {
    return send(res, 503, { error: 'O administrador ainda não configurou a chave da Groq neste servidor. Acesse /admin.html.' });
  }

  const body = await readJson(req);
  if (!body || !Array.isArray(body.messages) || !body.model) {
    return send(res, 400, { error: 'Corpo inválido: esperado { model, messages }.' });
  }

  const temperature = Number.isFinite(body.temperature) ? Number(body.temperature) : 0.7;
  const maxTokens = Number.isFinite(body.max_completion_tokens) ? Number(body.max_completion_tokens) : 1024;

  let upstream;
  try {
    upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: body.model,
        messages: body.messages,
        stream: true,
        temperature,
        max_completion_tokens: maxTokens
      })
    });
  } catch (e) {
    return send(res, 502, { error: 'Falha ao conectar com a Groq.' });
  }

  if (!upstream.ok || !upstream.body) {
    let errText = 'Erro ' + upstream.status + ' na Groq';
    try { const j = await upstream.json(); errText = (j.error && j.error.message) || errText; } catch (e) {}
    return send(res, upstream.status || 502, { error: errText });
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder('utf-8');

  req.on('close', () => { try { reader.cancel(); } catch (e) {} });

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
  } catch (e) {
    // conexão caiu no meio do stream — sem muito o que fazer aqui
  } finally {
    res.end();
  }
};
