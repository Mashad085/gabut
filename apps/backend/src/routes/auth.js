import Router from '@koa/router';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/postgres.js';
import { cache } from '../db/redis.js';
import { rabbitMQ } from '../services/rabbitmq.js';
import { authenticate } from '../middleware/authenticate.js';

const router = new Router();

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).regex(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/,
    'Password must contain uppercase, lowercase, and number'),
  full_name: z.string().min(2).max(255),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  totp_code: z.string().optional(),
});

// Generate tokens
const generateTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { sub: userId, role, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};

// POST /register
router.post('/register', async (ctx) => {
  const body = registerSchema.parse(ctx.request.body);
  
  // Check existing user
  const existing = await db.query(
    'SELECT id FROM users WHERE email = $1 OR username = $2',
    [body.email, body.username]
  );
  
  if (existing.rows.length > 0) {
    ctx.status = 409;
    ctx.body = { error: 'Email or username already taken' };
    return;
  }
  
  const passwordHash = await bcrypt.hash(body.password, 12);
  const userId = uuidv4();
  
  // Create user
  const user = await db.query(
    `INSERT INTO users (id, email, username, password_hash, full_name, phone)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, username, full_name, role`,
    [userId, body.email, body.username, passwordHash, body.full_name, body.phone]
  );
  
  // Create default savings account
  const accountNumber = `CF${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  await db.query(
    `INSERT INTO bank_accounts (user_id, account_number, account_type, account_name, is_primary)
     VALUES ($1, $2, 'savings', 'Tabungan Utama', true)`,
    [userId, accountNumber]
  );
  
  // Publish welcome event
  await rabbitMQ.publish(rabbitMQ.queues.EMAILS, {
    type: 'welcome',
    userId,
    email: body.email,
    name: body.full_name,
  });
  
  const tokens = generateTokens(userId, 'member');
  
  ctx.status = 201;
  ctx.body = {
    message: 'Account created successfully',
    user: user.rows[0],
    ...tokens,
  };
});

// POST /login
router.post('/login', async (ctx) => {
  const body = loginSchema.parse(ctx.request.body);
  
  const result = await db.query(
    'SELECT * FROM users WHERE email = $1 AND is_active = true',
    [body.email]
  );
  
  if (result.rows.length === 0) {
    ctx.status = 401;
    ctx.body = { error: 'Invalid credentials' };
    return;
  }
  
  const user = result.rows[0];
  const valid = await bcrypt.compare(body.password, user.password_hash);
  
  if (!valid) {
    // Audit log failed attempt
    await db.query(
      `INSERT INTO audit_logs (user_id, action, ip_address, metadata)
       VALUES ($1, 'login_failed', $2, $3)`,
      [user.id, ctx.ip, JSON.stringify({ email: body.email })]
    );
    ctx.status = 401;
    ctx.body = { error: 'Invalid credentials' };
    return;
  }
  
  // Check 2FA if enabled
  if (user.two_factor_enabled) {
    if (!body.totp_code) {
      ctx.status = 200;
      ctx.body = { requires_2fa: true, message: 'Please provide 2FA code' };
      return;
    }
    
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: body.totp_code,
      window: 2,
    });
    
    if (!verified) {
      ctx.status = 401;
      ctx.body = { error: 'Invalid 2FA code' };
      return;
    }
  }
  
  // Update last login
  await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
  
  // Audit log
  await db.query(
    `INSERT INTO audit_logs (user_id, action, ip_address, user_agent)
     VALUES ($1, 'login_success', $2, $3)`,
    [user.id, ctx.ip, ctx.headers['user-agent']]
  );
  
  const tokens = generateTokens(user.id, user.role);
  
  // Cache user session
  await cache.setSession(user.id, {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  });
  
  ctx.body = {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      role: user.role,
      two_factor_enabled: user.two_factor_enabled,
    },
    ...tokens,
  };
});

// POST /refresh
router.post('/refresh', async (ctx) => {
  const { refreshToken } = ctx.request.body;
  if (!refreshToken) {
    ctx.status = 401;
    ctx.body = { error: 'Refresh token required' };
    return;
  }
  
  const blacklisted = await cache.isBlacklisted(refreshToken);
  if (blacklisted) {
    ctx.status = 401;
    ctx.body = { error: 'Token revoked' };
    return;
  }
  
  const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  
  const user = await db.query(
    'SELECT id, role, is_active FROM users WHERE id = $1',
    [payload.sub]
  );
  
  if (!user.rows[0]?.is_active) {
    ctx.status = 401;
    ctx.body = { error: 'Account deactivated' };
    return;
  }
  
  const tokens = generateTokens(payload.sub, user.rows[0].role);
  
  // Blacklist old refresh token
  await cache.blacklistToken(refreshToken, 604800);
  
  ctx.body = tokens;
});

// POST /logout
router.post('/logout', authenticate, async (ctx) => {
  const { refreshToken } = ctx.request.body;
  
  // Destroy session
  await cache.destroySession(ctx.state.user.sub);
  
  if (refreshToken) {
    await cache.blacklistToken(refreshToken, 604800);
  }
  
  ctx.body = { message: 'Logged out successfully' };
});

// GET /me
router.get('/me', authenticate, async (ctx) => {
  const user = await db.query(
    `SELECT u.id, u.email, u.username, u.full_name, u.avatar_url, u.phone,
            u.role, u.is_verified, u.two_factor_enabled, u.last_login_at,
            u.created_at,
            COUNT(DISTINCT ba.id) as account_count
     FROM users u
     LEFT JOIN bank_accounts ba ON ba.user_id = u.id AND ba.is_active = true
     WHERE u.id = $1
     GROUP BY u.id`,
    [ctx.state.user.sub]
  );
  
  ctx.body = user.rows[0];
});

// POST /2fa/setup
router.post('/2fa/setup', authenticate, async (ctx) => {
  const user = await db.query('SELECT email, username FROM users WHERE id = $1', [ctx.state.user.sub]);
  
  const secret = speakeasy.generateSecret({
    name: `CommunityFinance (${user.rows[0].email})`,
    issuer: 'CommunityFinance',
  });
  
  // Store temporarily in Redis
  await cache.set(`2fa_setup:${ctx.state.user.sub}`, secret.base32, 300);
  
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
  
  ctx.body = {
    secret: secret.base32,
    qr_code: qrCodeUrl,
    message: 'Scan QR code with your authenticator app',
  };
});

// POST /2fa/verify
router.post('/2fa/verify', authenticate, async (ctx) => {
  const { totp_code } = ctx.request.body;
  const secret = await cache.get(`2fa_setup:${ctx.state.user.sub}`);
  
  if (!secret) {
    ctx.status = 400;
    ctx.body = { error: '2FA setup session expired, please try again' };
    return;
  }
  
  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: totp_code,
    window: 2,
  });
  
  if (!verified) {
    ctx.status = 400;
    ctx.body = { error: 'Invalid code' };
    return;
  }
  
  await db.query(
    'UPDATE users SET two_factor_enabled = true, two_factor_secret = $1 WHERE id = $2',
    [secret, ctx.state.user.sub]
  );
  
  await cache.del(`2fa_setup:${ctx.state.user.sub}`);
  
  ctx.body = { message: '2FA enabled successfully' };
});

// POST /change-password
router.post('/change-password', authenticate, async (ctx) => {
  const { current_password, new_password } = ctx.request.body;
  
  const user = await db.query('SELECT password_hash FROM users WHERE id = $1', [ctx.state.user.sub]);
  const valid = await bcrypt.compare(current_password, user.rows[0].password_hash);
  
  if (!valid) {
    ctx.status = 400;
    ctx.body = { error: 'Current password is incorrect' };
    return;
  }
  
  const newHash = await bcrypt.hash(new_password, 12);
  await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, ctx.state.user.sub]);
  
  ctx.body = { message: 'Password changed successfully' };
});

export default router;
