// Classifica os modelos da Groq por capacidade.
// Hoje a Groq só tem modelos de texto (chat) e modelos de texto+visão
// (conseguem "ler" imagem, não gerar). Não existe modelo só-imagem na Groq,
// mas a lógica já fica pronta pra isso caso apareça no futuro.

const EXCLUDE_RE = /whisper|tts|guard|moderation|playai/i; // não são modelos de chat
const VISION_RE = /scout|maverick|vision|llama-4|pixtral|llava|-vl-|vl-instruct|qwen3\.6/i;
const TOOL_RE = /compound/i; // modelos com ferramentas embutidas (busca, code exec)

// Lista usada só quando ainda não há chave da Groq configurada, ou quando a
// listagem ao vivo (/v1/models) falha. Mantida com os modelos que a própria
// Groq recomenda hoje como substitutos dos que já foram descontinuados —
// ver https://console.groq.com/docs/deprecations. Vários nomes "clássicos"
// (llama-3.3-70b-versatile, llama-3.1-8b-instant, llama-4-scout/maverick,
// qwen3-32b, gemma2-9b-it, kimi-k2-instruct) já saíram do ar; não usar mais.
const FALLBACK_MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.6-27b',
  'groq/compound',
  'groq/compound-mini'
].map((id) => ({ id }));

function isChatCapableId(id) { return !EXCLUDE_RE.test(id); }
function isVisionId(id) { return VISION_RE.test(id); }
function isToolId(id) { return TOOL_RE.test(id); }

function friendlyName(id) { return id.split('/').pop(); }

function tagModel(rawModel) {
  const id = rawModel.id;
  const capabilities = ['chat'];
  if (isVisionId(id)) capabilities.push('imagem');
  return {
    id,
    name: friendlyName(id),
    capabilities,             // ['chat'] ou ['chat','imagem']
    label: capabilities.join('/'), // "chat" ou "chat/imagem"
    tools: isToolId(id),
    provider: 'groq'
  };
}

function tagAndFilterModels(rawModels) {
  return rawModels
    .filter((m) => isChatCapableId(m.id))
    .map(tagModel)
    .sort((a, b) => a.id.localeCompare(b.id));
}

// ---- Hugging Face (Inference Providers) ----
// A HF expõe um router compatível com OpenAI (router.huggingface.co/v1) que
// serve modelos de vários provedores por trás (fireworks, together, deepinfra,
// hf-inference, etc). O id de cada modelo aqui vem prefixado com "hf:" pra
// diferenciar da Groq sem precisar de mais nenhum campo — api/chat.js usa
// esse prefixo pra saber pra qual provedor rotear.
const HF_VISION_RE = /vision|-vl-|vl-instruct|llava|pixtral/i;

// Modelos usados quando ainda não há token da HF configurado, ou quando a
// listagem ao vivo falha. Todos com bom suporte gratuito/de baixo custo entre
// os provedores da HF (fireworks, together, hf-inference, deepinfra...).
const HF_FALLBACK_MODELS = [
  'meta-llama/Llama-3.1-8B-Instruct',
  'meta-llama/Llama-3.3-70B-Instruct',
  'Qwen/Qwen2.5-7B-Instruct',
  'Qwen/Qwen3-8B',
  'google/gemma-3-4b-it',
  'deepseek-ai/DeepSeek-V3',
  'openai/gpt-oss-20b',
  'moonshotai/Kimi-K2-Instruct'
].map((id) => ({ id }));

function tagHfModel(rawModel) {
  const id = rawModel.id;
  const arch = rawModel.architecture || {};
  const inputMods = arch.input_modalities || [];
  const capabilities = ['chat'];
  if (inputMods.includes('image') || HF_VISION_RE.test(id)) capabilities.push('imagem');
  return {
    id: 'hf:' + id,
    name: friendlyName(id),
    capabilities,
    label: capabilities.join('/'),
    tools: false,
    provider: 'huggingface'
  };
}

function tagAndFilterHfModels(rawModels) {
  return rawModels
    .filter((m) => {
      // A lista da fallback não tem "providers" (não veio da API) — deixa passar.
      // A lista ao vivo só entra se tiver pelo menos um provedor "live" por trás.
      if (!Array.isArray(m.providers)) return true;
      return m.providers.some((p) => p.status === 'live');
    })
    .map(tagHfModel)
    .sort((a, b) => a.id.localeCompare(b.id));
}

module.exports = {
  tagAndFilterModels,
  tagModel,
  FALLBACK_MODELS,
  friendlyName,
  tagAndFilterHfModels,
  tagHfModel,
  HF_FALLBACK_MODELS
};
