// Beira Cloud · v4.0-Render 版（云部署 + R2 持久化）
//
// 用法：
//   1. 部署到 Render：env 填 R2 + SECRET，Render 自动 npm install + npm start
//   2. 工人用 Render 给的 URL 进系统，worker1 / pass123 登录
//
// 数据存在 Cloudflare R2（10GB 免费）。每次写 PUT 一次，备份写到 .bak.json。
// 没配 R2 环境变量时回退到本地文件（老大手动跑模式仍可用）。

import express from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import crypto from 'crypto';
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SECRET || 'beira-quick-deploy-2026-change-me-in-production';

// ===== 用户表（硬编码，3 个账号够用）=====
// 第一个用户是老板（admin），其他是工人（worker）
// 改密码：直接改这里，重启服务器
const USERS = {
  admin:   { password: 'admin123', role: 'admin',  display: '老板', displayPt: 'Chefe' },
  worker1: { password: 'pass123',  role: 'worker', display: '工人', displayPt: 'Operário' },
  worker2: { password: 'pass123',  role: 'worker', display: '工人', displayPt: 'Operário' },
};

// ===== 存储后端（自动选 R2 或本地文件）=====
const useR2 = !!(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);

let s3 = null;
const R2_KEY = 'store.json';
const R2_BAK_KEY = 'store.bak.json';
if (useR2) {
  s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  console.log('[R2] 启用 R2 模式，bucket:', process.env.R2_BUCKET);
} else {
  console.log('[file] 本地文件模式（未配 R2）');
}

// 本地文件（fallback）
const DATA_DIR = join(__dirname, 'data');
const DATA_FILE = join(DATA_DIR, 'store.json');
const DATA_BAK = join(DATA_DIR, 'store.bak.json');
if (!useR2 && !existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const EMPTY = { settings: { lang: 'zh' }, users: {}, customers: [], shipments: [], containers: [] };

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function readData() {
  if (useR2) {
    try {
      const r = await s3.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: R2_KEY }));
      return JSON.parse(await streamToString(r.Body));
    } catch (e) {
      if (e.name === 'NoSuchKey') return { ...EMPTY };
      throw e;
    }
  } else {
    try {
      return JSON.parse(readFileSync(DATA_FILE, 'utf8'));
    } catch {
      // 首次启动：写一份
      writeFileSync(DATA_FILE, JSON.stringify(EMPTY, null, 2));
      return EMPTY;
    }
  }
}

async function writeData(obj) {
  const content = JSON.stringify(obj, null, 2);
  if (useR2) {
    // 备份写到 R2（覆盖之前的）
    try {
      const oldR = await s3.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: R2_KEY }));
      const oldContent = await streamToString(oldR.Body);
      await s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: R2_BAK_KEY,
        Body: oldContent,
        ContentType: 'application/json',
      }));
    } catch { /* 首次写，没有备份可拿，忽略 */ }
    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: R2_KEY,
      Body: content,
      ContentType: 'application/json',
    }));
  } else {
    if (existsSync(DATA_FILE)) copyFileSync(DATA_FILE, DATA_BAK);
    writeFileSync(DATA_FILE, content);
  }
}

// 串行化写（防止并发覆盖）
let writeChain = Promise.resolve();
function safeWriteData(content) {
  writeChain = writeChain.then(() => writeData(content));
  return writeChain;
}

// ===== Token（HMAC 签名，30 天过期）=====
function signToken(username, role) {
  const expires = Date.now() + 30 * 24 * 3600 * 1000;
  const payload = `${username}|${role}|${expires}`;
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}|${sig}`).toString('base64');
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const [u, r, exp, sig] = Buffer.from(token, 'base64').toString('utf8').split('|');
    if (!u || !r || !exp || !sig) return null;
    if (Date.now() > Number(exp)) return null;
    const expected = crypto.createHmac('sha256', SECRET).update(`${u}|${r}|${exp}`).digest('hex');
    if (sig !== expected) return null;
    if (!USERS[u] || USERS[u].role !== r) return null;
    return { username: u, role: r, display: USERS[u].display, displayPt: USERS[u].displayPt };
  } catch (e) { return null; }
}

// ===== Express =====
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

function authMiddleware(req, res, next) {
  const user = verifyToken(req.cookies?.beira_token);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  req.user = user;
  next();
}

// ===== 公共端点 =====
app.get('/api/health', (req, res) => {
  res.json({ ok: true, version: '4.0.0-render', storage: useR2 ? 'r2' : 'file' });
});

// 登录
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = USERS[username];
  if (!u || u.password !== password) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const token = signToken(username, u.role);
  res.cookie('beira_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 3600 * 1000,
  });
  res.json({ ok: true, username, role: u.role, display: u.display, displayPt: u.displayPt });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('beira_token');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const user = verifyToken(req.cookies?.beira_token);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  res.json(user);
});

// ===== 数据端点 =====
app.get('/api/data', authMiddleware, async (req, res) => {
  try {
    res.json(await readData());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/data', authMiddleware, async (req, res) => {
  try {
    const obj = req.body || {};
    await safeWriteData(obj);
    res.json({ ok: true });
  } catch (e) {
    console.error('writeData failed', e);
    res.status(500).json({ error: e.message });
  }
});

// ===== 静态前端（V3 改造版）=====
app.use(express.static(join(__dirname, 'public')));

// 启动
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Beira Cloud · v4.0 云端版`);
  console.log(`   URL:    http://localhost:${PORT}`);
  console.log(`   Storage: ${useR2 ? 'Cloudflare R2 (' + process.env.R2_BUCKET + ')' : '本地文件 (fallback)'}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});
