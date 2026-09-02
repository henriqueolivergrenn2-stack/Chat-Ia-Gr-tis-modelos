const { send } = require('../../lib/http');
const { clearSessionCookie } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
  clearSessionCookie(req, res);
  send(res, 200, { ok: true });
};
