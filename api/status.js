const { send } = require('../lib/http');
const { getGroqKey, getHfKey } = require('../lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' });
  // "ready" tem que refletir a mesma regra do /api/models: pronto se PELO
  // MENOS UM dos dois provedores (Groq ou Hugging Face) já tiver chave.
  const [groqKey, hfKey] = await Promise.all([getGroqKey(), getHfKey()]);
  send(res, 200, { ready: !!(groqKey || hfKey) });
};
