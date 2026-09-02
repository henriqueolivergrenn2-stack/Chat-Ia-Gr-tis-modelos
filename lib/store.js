const fs = require('fs');
const path = require('path');

const isVercel = !!process.env.VERCEL;

// Arquivo local: usado no Termux/servidor próprio (persiste de verdade).
// Na Vercel usamos /tmp — funciona, mas NÃO é durável entre deploys/instâncias frias.
const LOCAL_FILE = path.join(process.cwd(), 'data', 'config.json');
const TMP_FILE = '/tmp/groqchat-config.json';
const FILE_PATH = isVercel ? TMP_FILE : LOCAL_FILE;

// KV opcional (Vercel KV ou Upstash Redis) via REST API — se configurado, tem prioridade
// sobre o arquivo, porque é durável em ambiente serverless.
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const hasKvStore = !!(KV_URL && KV_TOKEN);

async function kvGet(key) {
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j && j.result != null ? j.result : null;
}
async function kvSet(key, value) {
  const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  return r.ok;
}

function readLocal() {
  try { return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8')); } catch (e) { return null; }
}
function writeLocal(data) {
  try {
    fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (e) { return false; }
}

// GROQ_API_KEY no ambiente sempre vence (útil pra fixar em produção via painel da Vercel).
async function getGroqKey() {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY.trim();
  if (hasKvStore) {
    try { const v = await kvGet('groq_api_key'); if (v) return v; } catch (e) {}
  }
  const local = readLocal();
  return (local && local.groqApiKey) || '';
}

async function setGroqKey(key) {
  if (process.env.GROQ_API_KEY) {
    return { ok: false, reason: 'GROQ_API_KEY está fixa por variável de ambiente neste servidor — remova-a das variáveis de ambiente pra poder trocar por aqui.' };
  }
  if (hasKvStore) {
    const ok = await kvSet('groq_api_key', key);
    return { ok, reason: ok ? null : 'Falha ao gravar no KV.' };
  }
  const cur = readLocal() || {};
  cur.groqApiKey = key;
  const ok = writeLocal(cur);
  return {
    ok,
    reason: ok ? null : 'Falha ao gravar o arquivo local.',
    ephemeralWarning: isVercel && !hasKvStore
  };
}

function storageMode() {
  if (process.env.GROQ_API_KEY) return 'env';
  if (hasKvStore) return 'kv';
  if (isVercel) return 'tmp-ephemeral';
  return 'file';
}

module.exports = { getGroqKey, setGroqKey, storageMode, hasKvStore, isVercel };
