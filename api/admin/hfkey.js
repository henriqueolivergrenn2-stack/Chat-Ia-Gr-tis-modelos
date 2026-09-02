const { send, readJson, mask } = require('../../lib/http');
const { getSession } = require('../../lib/auth');
const { getHfKey, setHfKey, storageMode } = require('../../lib/store');

module.exports = async (req, res) => {
  const session = getSession(req);
  if (!session || session.role !== 'admin') {
    return send(res, 401, { error: 'Não autenticado. Faça login primeiro.' });
  }

  if (req.method === 'GET') {
    const key = await getHfKey();
    return send(res, 200, { hasKey: !!key, masked: mask(key), storageMode: storageMode('hf') });
  }

  if (req.method === 'POST') {
    const body = await readJson(req);
    const apiKey = ((body && body.apiKey) || '').trim();
    if (!apiKey) return send(res, 400, { error: 'Informe um token.' });

    // testa o token contra o router da Hugging Face antes de salvar
    try {
      const r = await fetch('https://router.huggingface.co/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        const em = j.error && (j.error.message || j.error);
        return send(res, 400, { error: 'A Hugging Face recusou esse token: ' + (em || ('status ' + r.status)) });
      }
    } catch (e) {
      return send(res, 502, { error: 'Não consegui validar o token com a Hugging Face agora. Tente de novo.' });
    }

    const result = await setHfKey(apiKey);
    if (!result.ok) {
      return send(res, 500, { error: result.reason || 'Falha ao salvar o token.' });
    }
    return send(res, 200, {
      ok: true,
      masked: mask(apiKey),
      storageMode: storageMode('hf'),
      ephemeralWarning: result.ephemeralWarning || false
    });
  }

  return send(res, 405, { error: 'method not allowed' });
};
