#!/usr/bin/env node
/**
 * Servidor local pro groq.chat — pensado pra rodar sem nenhuma dependência
 * de npm (bom pro Termux, onde instalar pacotes nativos pode ser dor de cabeça).
 *
 *   node server.js
 *
 * Variáveis de ambiente (pode usar um arquivo .env na raiz, veja loadEnvFile):
 *   PORT             porta do servidor (padrão 3000)
 *   ADMIN_PASSWORD   senha do painel /admin.html (obrigatória pra usar o admin)
 *   SESSION_SECRET   segredo pra assinar o cookie de sessão do admin (recomendado)
 *   GROQ_API_KEY     se definida, fixa a chave da Groq (o admin não poderá trocar por aqui)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

loadEnvFile();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const routes = {
  'GET /api/status': require('./api/status'),
  'GET /api/models': require('./api/models'),
  'POST /api/chat': require('./api/chat'),
  'POST /api/admin/login': require('./api/admin/login'),
  'POST /api/admin/logout': require('./api/admin/logout'),
  'GET /api/admin/key': require('./api/admin/key'),
  'POST /api/admin/key': require('./api/admin/key'),
  'GET /api/admin/whoami': require('./api/admin/whoami')
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(PUBLIC_DIR, filePath);
  if (!full.startsWith(PUBLIC_DIR)) { res.statusCode = 403; return res.end('forbidden'); }

  fs.readFile(full, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('404 - não encontrado');
    }
    const ext = path.extname(full);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url);
  const key = `${req.method} ${parsed.pathname}`;
  const handler = routes[key];

  if (handler) {
    try {
      await handler(req, res);
    } catch (e) {
      console.error('Erro no handler', key, e);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Erro interno no servidor.' }));
      }
    }
    return;
  }

  if (parsed.pathname.startsWith('/api/')) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'rota não encontrada' }));
  }

  serveStatic(req, res, parsed.pathname);
});

server.listen(PORT, () => {
  console.log(`\n  groq.chat rodando em http://localhost:${PORT}`);
  console.log(`  painel de admin em    http://localhost:${PORT}/admin.html\n`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log('  ⚠ ADMIN_PASSWORD não definida — o painel de admin vai recusar login até você configurar.');
    console.log('    Crie um arquivo .env (copie de .env.example) ou exporte a variável antes de rodar.\n');
  }
});

/* Carregador minúsculo de .env, sem depender do pacote "dotenv" */
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const idx = t.indexOf('=');
    if (idx === -1) return;
    const k = t.slice(0, idx).trim();
    let v = t.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  });
}
