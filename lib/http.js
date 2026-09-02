const crypto = require('crypto');

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve) => {
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'object') return resolve(req.body);
      try { return resolve(JSON.parse(req.body)); } catch (e) { return resolve({}); }
    }
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function isHttps(req) {
  const proto = req.headers['x-forwarded-proto'];
  if (proto) return proto.split(',')[0].trim() === 'https';
  return !!(req.socket && req.socket.encrypted);
}

function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ab.length !== bb.length) {
    // faz uma comparação de mesmo custo pra não vazar timing pelo tamanho
    try { crypto.timingSafeEqual(Buffer.alloc(bb.length || 1), Buffer.alloc(bb.length || 1)); } catch (e) {}
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

function mask(key) {
  if (!key) return '';
  if (key.length <= 8) return '•'.repeat(key.length);
  return key.slice(0, 4) + '•'.repeat(Math.max(4, key.length - 8)) + key.slice(-4);
}

module.exports = { send, readJson, isHttps, timingSafeEqualStr, mask };
