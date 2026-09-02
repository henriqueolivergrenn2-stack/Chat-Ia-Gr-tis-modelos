const { send } = require('../lib/http');
const { getGroqKey, getHfKey } = require('../lib/store');
const {
  tagAndFilterModels, FALLBACK_MODELS,
  tagAndFilterHfModels, HF_FALLBACK_MODELS
} = require('../lib/models');

async function loadGroqModels() {
  const key = await getGroqKey();
  if (!key) {
    return {
      models: tagAndFilterModels(FALLBACK_MODELS),
      ready: false,
      warning: 'O administrador ainda não configurou a chave da Groq neste servidor.'
    };
  }
  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` }
    });
    if (!r.ok) throw new Error('status ' + r.status);
    const data = await r.json();
    return { models: tagAndFilterModels(data.data || []), ready: true, warning: null };
  } catch (e) {
    return {
      models: tagAndFilterModels(FALLBACK_MODELS),
      ready: true,
      warning: 'Não consegui atualizar a lista com a Groq agora, mostrando modelos padrão.'
    };
  }
}

async function loadHfModels() {
  const key = await getHfKey();
  if (!key) {
    return {
      models: tagAndFilterHfModels(HF_FALLBACK_MODELS),
      ready: false,
      warning: 'O administrador ainda não configurou o token da Hugging Face neste servidor.'
    };
  }
  try {
    const r = await fetch('https://router.huggingface.co/v1/models', {
      headers: { Authorization: `Bearer ${key}` }
    });
    if (!r.ok) throw new Error('status ' + r.status);
    const data = await r.json();
    return { models: tagAndFilterHfModels(data.data || []), ready: true, warning: null };
  } catch (e) {
    return {
      models: tagAndFilterHfModels(HF_FALLBACK_MODELS),
      ready: true,
      warning: 'Não consegui atualizar a lista com a Hugging Face agora, mostrando modelos padrão.'
    };
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' });

  const [groq, hf] = await Promise.all([loadGroqModels(), loadHfModels()]);
  const models = [...groq.models, ...hf.models];
  // "ready" fica true se PELO MENOS UM provedor (Groq ou Hugging Face) já
  // tiver chave configurada — dá pra conversar mesmo que só um dos dois
  // esteja pronto; escolher um modelo do outro dá erro claro na hora do envio.
  const ready = groq.ready || hf.ready;
  const warning = [groq.warning, hf.warning].filter(Boolean).join(' ') || undefined;

  send(res, 200, { ready, models, warning });
};
