const { send, readJson } = require('../../lib/http');
const { getSession } = require('../../lib/auth');
const { getGroqKey, setGroqKey, storageMode } = require('../../lib/store');

function mask(key) {
  if (!key) return '';
  if (key.length <= 8) return '•'.repeat(key.length);
  return key.slice(0, 4) + '•'.repeat(Math.max(4, key.length - 8)) + key.slice(-4);
}

module.exports = async (req, res) => {
  const session = getSession(req);
  if (!session || session.role !== 'admin') {
    return send(res, 401, { error: 'Não autenticado. Faça login primeiro.' });
  }

  if (req.method === 'GET') {
    const key = await getGroqKey();
    return send(res, 200, { hasKey: !!key, masked: mask(key), storageMode: storageMode() });
  }

  if (req.method === 'POST') {
    const body = await readJson(req);
    const apiKey = ((body && body.apiKey) || '').trim();
    if (!apiKey) return send(res, 400, { error: 'Informe uma chave.' });

    // testa a chave contra a Groq antes de salvar, pra evitar salvar algo quebrado
    try {
      const r = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        return send(res, 400, { error: 'A Groq recusou essa chave: ' + ((j.error && j.error.message) || ('status ' + r.status)) });
      }
    } catch (e) {
      return send(res, 502, { error: 'Não consegui validar a chave com a Groq agora. Tente de novo.' });
    }

    const result = await setGroqKey(apiKey);
    if (!result.ok) {
      return send(res, 500, { error: result.reason || 'Falha ao salvar a chave.' });
    }
    return send(res, 200, {
      ok: true,
      masked: mask(apiKey),
      storageMode: storageMode(),
      ephemeralWarning: result.ephemeralWarning || false
    });
  }

  return send(res, 405, { error: 'method not allowed' });
};
