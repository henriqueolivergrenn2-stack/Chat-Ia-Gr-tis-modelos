// Classifica os modelos da Groq por capacidade.
// Hoje a Groq só tem modelos de texto (chat) e modelos de texto+visão
// (conseguem "ler" imagem, não gerar). Não existe modelo só-imagem na Groq,
// mas a lógica já fica pronta pra isso caso apareça no futuro.

const EXCLUDE_RE = /whisper|tts|guard|moderation|playai/i; // não são modelos de chat
const VISION_RE = /scout|maverick|vision|llama-4|pixtral|llava|-vl-|vl-instruct/i;
const TOOL_RE = /compound/i; // modelos com ferramentas embutidas (busca, code exec)

const FALLBACK_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3-32b',
  'gemma2-9b-it',
  'moonshotai/kimi-k2-instruct',
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
    tools: isToolId(id)
  };
}

function tagAndFilterModels(rawModels) {
  return rawModels
    .filter((m) => isChatCapableId(m.id))
    .map(tagModel)
    .sort((a, b) => a.id.localeCompare(b.id));
}

module.exports = { tagAndFilterModels, tagModel, FALLBACK_MODELS, friendlyName };
