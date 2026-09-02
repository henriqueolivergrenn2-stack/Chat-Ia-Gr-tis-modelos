const { send, readJson } = require('../lib/http');
const { getGroqKey, getHfKey } = require('../lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });

  const body = await readJson(req);
  if (!body || !Array.isArray(body.messages) || !body.model) {
    return send(res, 400, { error: 'Corpo inválido: esperado { model, messages }.' });
  }

  // Modelos da Hugging Face chegam do /api/models já prefixados com "hf:" —
  // é só nisso que a gente se baseia pra decidir pra qual provedor rotear.
  const isHf = body.model.startsWith('hf:');
  const modelId = isHf ? body.model.slice(3) : body.model;
  const providerName = isHf ? 'Hugging Face' : 'Groq';

  const key = isHf ? await getHfKey() : await getGroqKey();
  if (!key) {
    return send(res, 503, {
      error: `O administrador ainda não configurou ${isHf ? 'o token da Hugging Face' : 'a chave da Groq'} neste servidor. Acesse /admin.html.`
    });
  }

  const temperature = Number.isFinite(body.temperature) ? Number(body.temperature) : 0.7;
  const maxTokens = Number.isFinite(body.max_completion_tokens) ? Number(body.max_completion_tokens) : 1024;

  const upstreamUrl = isHf
    ? 'https://router.huggingface.co/v1/chat/completions'
    : 'https://api.groq.com/openai/v1/chat/completions';

  // O router da HF serve cada modelo através de um ou mais provedores por trás
  // (fireworks, together, deepinfra, hf-inference...). Sem nenhum sufixo, o
  // próprio router já escolhe automaticamente o provedor mais rápido disponível
  // — que é exatamente o comportamento que queremos, sem precisar expor essa
  // escolha em /admin.html. IMPORTANTE: ":auto" NÃO é um sufixo válido pra HF
  // (só existem ":fastest", ":cheapest", ":preferred" ou o nome de um provedor
  // específico, ex. ":groq"); mandar ":auto" faz a HF procurar um provedor
  // chamado "auto", que não existe, e o request falha sempre. Por isso aqui a
  // gente só repassa o modelId como veio (já sem o prefixo "hf:").
  const upstreamModel = modelId;

  const payload = {
    model: upstreamModel,
    messages: body.messages,
    stream: true,
    temperature
  };
  // A Groq usa "max_completion_tokens"; o router da HF (OpenAI-compat) espera
  // "max_tokens" pros modelos que ele serve.
  if (isHf) payload.max_tokens = maxTokens;
  else payload.max_completion_tokens = maxTokens;

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    return send(res, 502, { error: `Falha ao conectar com a ${providerName}.` });
  }

  if (!upstream.ok || !upstream.body) {
    let errText = 'Erro ' + upstream.status + ' na ' + providerName;
    try {
      const j = await upstream.json();
      const em = j.error && (j.error.message || j.error);
      errText = em || errText;
    } catch (e) {}
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
