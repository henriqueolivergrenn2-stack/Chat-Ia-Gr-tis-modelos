const { send } = require('../lib/http');
const { getGroqKey } = require('../lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' });
  const key = await getGroqKey();
  send(res, 200, { ready: !!key });
};
