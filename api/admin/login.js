const { send, readJson, timingSafeEqualStr } = require('../../lib/http');
const { sign, setSessionCookie } = require('../../lib/auth');

const SESSION_HOURS = 12;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) {
    return send(res, 500, { error: 'ADMIN_PASSWORD não configurada no servidor. Defina essa variável de ambiente antes de usar o painel de admin.' });
  }

  const body = await readJson(req);
  const password = (body && body.password) || '';

  if (!timingSafeEqualStr(password, ADMIN_PASSWORD)) {
    return send(res, 401, { error: 'Senha incorreta.' });
  }

  const maxAge = SESSION_HOURS * 60 * 60;
  const token = sign({ role: 'admin', exp: Date.now() + maxAge * 1000 });
  setSessionCookie(req, res, token, maxAge);
  send(res, 200, { ok: true });
};
