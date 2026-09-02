const { send } = require('../lib/http');
const { getGroqKey } = require('../lib/store');
const { tagAndFilterModels, FALLBACK_MODELS } = require('../lib/models');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' });

  const key = await getGroqKey();
  if (!key) {
    return send(res, 200, {
      ready: false,
      models: tagAndFilterModels(FALLBACK_MODELS),
      warning: 'O administrador ainda não configurou a chave da Groq neste servidor.'
    });
  }

  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` }
    });
    if (!r.ok) throw new Error('status ' + r.status);
    const data = await r.json();
    const models = tagAndFilterModels(data.data || []);
    send(res, 200, { ready: true, models });
  } catch (e) {
    send(res, 200, {
      ready: true,
      models: tagAndFilterModels(FALLBACK_MODELS),
      warning: 'Não consegui atualizar a lista com a Groq agora, mostrando modelos padrão.'
    });
  }
};
