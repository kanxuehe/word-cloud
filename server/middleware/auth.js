const jwt = require('jsonwebtoken');

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'unauthorized', message: '缺少登录凭证' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    req.username = payload.username;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token', message: '登录已过期，请重新登录' });
  }
}

module.exports = { authRequired };
