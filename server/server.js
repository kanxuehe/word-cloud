const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 按 NODE_ENV 加载对应 .env 文件，找不到时回退到 .env
// .env 文件位于项目根目录
const NODE_ENV = process.env.NODE_ENV || 'development';
const rootDir = path.resolve(__dirname, '..');
const envCandidates = [
  path.join(rootDir, `.env.${NODE_ENV}.local`),
  path.join(rootDir, `.env.${NODE_ENV}`),
  path.join(rootDir, '.env.local'),
  path.join(rootDir, '.env'),
];
const envFile = envCandidates.find((p) => fs.existsSync(p));
if (envFile) {
  dotenv.config({ path: envFile });
  console.log(`[env] loaded ${path.basename(envFile)} (NODE_ENV=${NODE_ENV})`);
} else {
  dotenv.config();
  console.warn(`[env] no .env file found, using process.env only (NODE_ENV=${NODE_ENV})`);
}

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { connectDB } = require('./config/db');

const authRoutes = require('./routes/auth');
const wordRoutes = require('./routes/words');

const app = express();

// 部署在 Nginx 反代之后，让 Express 正确识别 X-Forwarded-For / Proto
app.set('trust proxy', 1);

// HTTPS_ENABLED 控制是否下发会强制浏览器走 HTTPS 的安全策略
// （HSTS 和 CSP 的 upgrade-insecure-requests）。
// HTTP 部署时若开启，浏览器会强制升级所有请求到 https，没有 443 就 ERR_SSL_PROTOCOL_ERROR。
const HTTPS_ENABLED = String(process.env.HTTPS_ENABLED || '').toLowerCase() === 'true';

const cspDirectives = {
  'script-src': [
    "'self'",
    'https://cdn.jsdelivr.net',
    'https://unpkg.com',
    "'unsafe-inline'",
  ],
  'style-src': ["'self'", 'https://cdn.jsdelivr.net', "'unsafe-inline'"],
  'img-src': ["'self'", 'data:'],
};
if (!HTTPS_ENABLED) {
  cspDirectives['upgrade-insecure-requests'] = null;
}

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: cspDirectives,
    },
    strictTransportSecurity: HTTPS_ENABLED
      ? { maxAge: 7776000, includeSubDomains: true } // 90 天
      : false,
  })
);

if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN.split(',') }));
}

app.use(express.json({ limit: '256kb' }));

app.use('/api/auth', authRoutes);
app.use('/api/words', wordRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.get('/', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'not_found', path: req.path });
  }
  return next();
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server]', err);
  res.status(500).json({ error: 'server_error', message: err.message });
});

const PORT = Number(process.env.PORT) || 1234;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/word_cloud';

(async () => {
  try {
    await connectDB(MONGO_URI);
    app.listen(PORT, () => {
      console.log(`[server] listening on http://127.0.0.1:${PORT}`);
    });
  } catch (err) {
    console.error('[server] failed to start:', err);
    process.exit(1);
  }
})();
