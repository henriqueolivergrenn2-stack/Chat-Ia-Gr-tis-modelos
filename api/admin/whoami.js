const { send } = require('../../lib/http');
const { getSession } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' });
  const session = getSession(req);
  send(res, 200, { authenticated: !!(session && session.role === 'admin') });
};
