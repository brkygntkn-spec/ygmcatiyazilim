import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';

type UserRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
type ModuleKey =
  | 'dashboard'
  | 'employees'
  | 'performance'
  | 'feedback360'
  | 'ninebox'
  | 'mobility'
  | 'assignments'
  | 'settings';

type DepartmentName = string;

interface UserPermissions {
  modules: Record<ModuleKey, boolean>;
  actions: {
    canApproveMobility: boolean;
    canCalibrateNineBox: boolean;
    canManage360Raters: boolean;
    canManageAssignments: boolean;
    canEditSystemRules: boolean;
    canManageUsers: boolean;
  };
}

interface StoredUser {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string; // scrypt "saltHex:derivedHex", empty string only for env-override virtual admin
  role: UserRole;
  department: DepartmentName;
  title: string;
  linkedEmployeeId: string | null;
  isActive: boolean;
  isPrimaryAdmin: boolean;
  permissions: UserPermissions;
  createdAt: string;
  lastLoginAt?: string;
}

interface SessionRecord {
  userId: string;
  expiresAt: number;
}

interface AuthedRequest extends Request {
  authUser?: StoredUser;
  authToken?: string;
}

const VALID_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'EMPLOYEE'];
function sanitizeDepartment(raw: unknown): string {
  if (typeof raw !== 'string') return 'Operasyon';
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return 'Operasyon';
  return trimmed;
}
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const DATA_DIR = path.resolve(process.cwd(), 'data');
const USERS_FILE = path.resolve(DATA_DIR, 'auth-users.json');

function getEnvAdminEmail(): string {
  const configured = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  return EMAIL_REGEX.test(configured) ? configured : 'admin@cati.com.tr';
}

function getEnvAdminPassword(): string {
  return (process.env.ADMIN_PASSWORD || '').trim();
}

function defaultPermissionsForRole(role: UserRole): UserPermissions {
  if (role === 'ADMIN') {
    return {
      modules: {
        dashboard: true,
        employees: true,
        performance: true,
        feedback360: true,
        ninebox: true,
        mobility: true,
        assignments: true,
        settings: true,
      },
      actions: {
        canApproveMobility: true,
        canCalibrateNineBox: true,
        canManage360Raters: true,
        canManageAssignments: true,
        canEditSystemRules: true,
        canManageUsers: true,
      },
    };
  }
  if (role === 'MANAGER') {
    return {
      modules: {
        dashboard: true,
        employees: true,
        performance: true,
        feedback360: true,
        ninebox: true,
        mobility: true,
        assignments: true,
        settings: false,
      },
      actions: {
        canApproveMobility: true,
        canCalibrateNineBox: true,
        canManage360Raters: true,
        canManageAssignments: true,
        canEditSystemRules: false,
        canManageUsers: false,
      },
    };
  }
  return {
    modules: {
      dashboard: true,
      employees: true,
      performance: true,
      feedback360: true,
      ninebox: false,
      mobility: false,
      assignments: true,
      settings: false,
    },
    actions: {
      canApproveMobility: false,
      canCalibrateNineBox: false,
      canManage360Raters: false,
      canManageAssignments: false,
      canEditSystemRules: false,
      canManageUsers: false,
    },
  };
}

function sanitizePermissions(raw: unknown, fallbackRole: UserRole): UserPermissions {
  const base = defaultPermissionsForRole(fallbackRole);
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  const rawMod = (obj.modules && typeof obj.modules === 'object' ? obj.modules : {}) as Record<
    string,
    unknown
  >;
  const rawAct = (obj.actions && typeof obj.actions === 'object' ? obj.actions : {}) as Record<
    string,
    unknown
  >;
  return {
    modules: {
      dashboard: typeof rawMod.dashboard === 'boolean' ? rawMod.dashboard : base.modules.dashboard,
      employees: typeof rawMod.employees === 'boolean' ? rawMod.employees : base.modules.employees,
      performance:
        typeof rawMod.performance === 'boolean' ? rawMod.performance : base.modules.performance,
      feedback360:
        typeof rawMod.feedback360 === 'boolean' ? rawMod.feedback360 : base.modules.feedback360,
      ninebox: typeof rawMod.ninebox === 'boolean' ? rawMod.ninebox : base.modules.ninebox,
      mobility: typeof rawMod.mobility === 'boolean' ? rawMod.mobility : base.modules.mobility,
      assignments:
        typeof rawMod.assignments === 'boolean' ? rawMod.assignments : base.modules.assignments,
      settings: typeof rawMod.settings === 'boolean' ? rawMod.settings : base.modules.settings,
    },
    actions: {
      canApproveMobility:
        typeof rawAct.canApproveMobility === 'boolean'
          ? rawAct.canApproveMobility
          : base.actions.canApproveMobility,
      canCalibrateNineBox:
        typeof rawAct.canCalibrateNineBox === 'boolean'
          ? rawAct.canCalibrateNineBox
          : base.actions.canCalibrateNineBox,
      canManage360Raters:
        typeof rawAct.canManage360Raters === 'boolean'
          ? rawAct.canManage360Raters
          : base.actions.canManage360Raters,
      canManageAssignments:
        typeof rawAct.canManageAssignments === 'boolean'
          ? rawAct.canManageAssignments
          : base.actions.canManageAssignments,
      canEditSystemRules:
        typeof rawAct.canEditSystemRules === 'boolean'
          ? rawAct.canEditSystemRules
          : base.actions.canEditSystemRules,
      canManageUsers:
        typeof rawAct.canManageUsers === 'boolean'
          ? rawAct.canManageUsers
          : base.actions.canManageUsers,
    },
  };
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyScryptPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

function verifyConstantTimeEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function loadUsersFromDisk(): StoredUser[] {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveUsersToDisk(list: StoredUser[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), { encoding: 'utf8', mode: 0o600 });
}

function toPublicUser(user: StoredUser) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    department: user.department,
    title: user.title,
    linkedEmployeeId: user.linkedEmployeeId,
    isActive: user.isActive,
    isPrimaryAdmin: user.isPrimaryAdmin,
    permissions: sanitizePermissions(user.permissions, user.role),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

// In-memory store backed by hashed disk persistence
let users: StoredUser[] = loadUsersFromDisk();
const sessions = new Map<string, SessionRecord>();
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function ensureEnvAdminRecord(): StoredUser | null {
  const envPwd = getEnvAdminPassword();
  if (!envPwd) return null;
  const envEmail = getEnvAdminEmail();
  let primary = users.find((u) => u.isPrimaryAdmin) || users.find((u) => u.email === envEmail);
  if (!primary) {
    primary = {
      id: 'usr-admin-primary',
      fullName: 'Elif Öztürk',
      email: envEmail,
      passwordHash: '', // verified via process.env.ADMIN_PASSWORD
      role: 'ADMIN',
      department: 'İnsan Kaynakları',
      title: 'İK ve Sistem Yöneticisi',
      linkedEmployeeId: 'emp-05',
      isActive: true,
      isPrimaryAdmin: true,
      permissions: defaultPermissionsForRole('ADMIN'),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    users.unshift(primary);
    saveUsersToDisk(users);
  } else if (primary.email !== envEmail) {
    primary.email = envEmail;
    primary.isPrimaryAdmin = true;
    primary.isActive = true;
    saveUsersToDisk(users);
  }
  return primary;
}

ensureEnvAdminRecord();

function isAdminInitialized(): boolean {
  if (getEnvAdminPassword().length > 0) return true;
  return users.some((u) => u.isPrimaryAdmin && u.passwordHash.length > 0);
}

function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function revokeUserSessions(userId: string): void {
  for (const [token, rec] of sessions.entries()) {
    if (rec.userId === userId) {
      sessions.delete(token);
    }
  }
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 20;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Oturum doğrulanamadı. Lütfen giriş yapın.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const session = sessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    sessions.delete(token);
    res.status(401).json({ error: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.' });
    return;
  }
  const user = users.find((u) => u.id === session.userId);
  if (!user || !user.isActive) {
    sessions.delete(token);
    res.status(403).json({ error: 'Hesap aktif değil veya bulunamadı.' });
    return;
  }
  req.authUser = user;
  req.authToken = token;
  next();
}

function requireUserManager(req: AuthedRequest, res: Response, next: NextFunction): void {
  const user = req.authUser;
  if (!user || (!user.isPrimaryAdmin && user.role !== 'ADMIN' && !user.permissions.actions.canManageUsers)) {
    res.status(403).json({ error: 'Bu işlem için kullanıcı yönetimi yetkiniz bulunmuyor.' });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  // Auth status (public, non-sensitive metadata only)
  app.get('/api/auth/status', (_req: Request, res: Response) => {
    ensureEnvAdminRecord();
    res.json({
      initialized: isAdminInitialized(),
      hasEnvAdmin: getEnvAdminPassword().length > 0,
      defaultAdminEmail: getEnvAdminEmail(),
    });
  });

  // One-time first-run admin bootstrap (locked once claimed or when ADMIN_PASSWORD env is set)
  app.post('/api/auth/setup-admin', (req: Request, res: Response) => {
    if (getEnvAdminPassword().length > 0 || isAdminInitialized()) {
      res.status(409).json({
        error: 'Yönetici hesabı zaten yapılandırılmış. Lütfen mevcut şifrenizle giriş yapın.',
      });
      return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : 'Elif Öztürk';
    const email =
      typeof body.email === 'string' && body.email.trim()
        ? body.email.trim().toLowerCase()
        : getEnvAdminEmail();
    const password = typeof body.password === 'string' ? body.password : '';

    if (!EMAIL_REGEX.test(email)) {
      res.status(400).json({ error: 'Geçerli bir kurumsal e-posta adresi giriniz.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Yönetici şifresi en az 8 karakter olmalıdır.' });
      return;
    }
    if (fullName.length < 2) {
      res.status(400).json({ error: 'Yönetici ad soyad alanı boş bırakılamaz.' });
      return;
    }

    const adminUser: StoredUser = {
      id: 'usr-admin-primary',
      fullName,
      email,
      passwordHash: hashPassword(password),
      role: 'ADMIN',
      department: 'İnsan Kaynakları',
      title: 'İK ve Sistem Yöneticisi',
      linkedEmployeeId: 'emp-05',
      isActive: true,
      isPrimaryAdmin: true,
      permissions: defaultPermissionsForRole('ADMIN'),
      createdAt: new Date().toISOString().slice(0, 10),
      lastLoginAt: new Date().toISOString(),
    };

    users = [adminUser, ...users.filter((u) => u.email !== email)];
    saveUsersToDisk(users);

    const token = createSession(adminUser.id);
    res.status(201).json({ token, user: toPublicUser(adminUser) });
  });

  // Login endpoint
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    const rateKey = `${req.ip || 'local'}:${email}`;
    if (!checkRateLimit(rateKey)) {
      res.status(429).json({
        error: 'Çok fazla başarısız giriş denemesi. Lütfen bir süre sonra tekrar deneyin.',
      });
      return;
    }

    if (!email || !password) {
      res.status(400).json({ error: 'E-posta ve şifre alanları zorunludur.' });
      return;
    }

    ensureEnvAdminRecord();
    const user = users.find((u) => u.email === email);
    if (!user) {
      res.status(401).json({ error: 'E-posta adresi veya şifre hatalı.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        error: 'Bu kullanıcı hesabı pasif durumdadır. Sistem yöneticinizle iletişime geçin.',
      });
      return;
    }

    const envAdminPwd = getEnvAdminPassword();
    let passwordValid = false;
    if (user.isPrimaryAdmin && envAdminPwd.length > 0) {
      // Configured process.env.ADMIN_PASSWORD always overrides claimed fallback hash
      passwordValid = verifyConstantTimeEqual(password, envAdminPwd);
    } else if (user.passwordHash) {
      passwordValid = verifyScryptPassword(password, user.passwordHash);
    }

    if (!passwordValid) {
      res.status(401).json({ error: 'E-posta adresi veya şifre hatalı.' });
      return;
    }

    user.lastLoginAt = new Date().toISOString();
    saveUsersToDisk(users);

    const token = createSession(user.id);
    res.json({ token, user: toPublicUser(user) });
  });

  // Logout
  app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res: Response) => {
    if (req.authToken) {
      sessions.delete(req.authToken);
    }
    res.json({ ok: true });
  });

  // Current user session profile
  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
    res.json({ user: toPublicUser(req.authUser!) });
  });

  // List all users (Admin / canManageUsers only)
  app.get('/api/users', requireAuth, requireUserManager, (_req: AuthedRequest, res: Response) => {
    res.json({ users: users.map(toPublicUser) });
  });

  // Create new member account (Admin / canManageUsers only)
  app.post('/api/users', requireAuth, requireUserManager, (req: AuthedRequest, res: Response) => {
    const actor = req.authUser!;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const role: UserRole = VALID_ROLES.includes(body.role) ? body.role : 'EMPLOYEE';
    const department: DepartmentName = sanitizeDepartment(body.department);
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : 'Uzman';
    const linkedEmployeeId =
      typeof body.linkedEmployeeId === 'string' && body.linkedEmployeeId.trim()
        ? body.linkedEmployeeId.trim().slice(0, 80)
        : null;

    if (role === 'ADMIN' && actor.role !== 'ADMIN') {
      res.status(403).json({ error: 'Yönetici (Admin) rolünde hesap yalnızca sistem yöneticisi tarafından oluşturulabilir.' });
      return;
    }
    if (fullName.length < 2 || fullName.length > 120) {
      res.status(400).json({ error: 'Ad soyad 2 ile 120 karakter arasında olmalıdır.' });
      return;
    }
    if (email.length > 160 || !EMAIL_REGEX.test(email)) {
      res.status(400).json({ error: 'Geçerli bir e-posta adresi giriniz.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Kullanıcı şifresi en az 8 karakter olmalıdır.' });
      return;
    }
    if (users.some((u) => u.email === email)) {
      res.status(409).json({ error: 'Bu e-posta adresiyle kayıtlı bir kullanıcı zaten mevcut.' });
      return;
    }

    const permissions = sanitizePermissions(body.permissions, role);
    const newUser: StoredUser = {
      id: `usr-${crypto.randomBytes(6).toString('hex')}`,
      fullName,
      email,
      passwordHash: hashPassword(password),
      role,
      department,
      title: title || 'Uzman',
      linkedEmployeeId,
      isActive: true,
      isPrimaryAdmin: false,
      permissions,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    users.push(newUser);
    saveUsersToDisk(users);

    res.status(201).json({ user: toPublicUser(newUser) });
  });

  // Update member role, permissions, active status, or password
  app.patch(
    '/api/users/:id',
    requireAuth,
    requireUserManager,
    (req: AuthedRequest, res: Response) => {
      const targetId = req.params.id;
      const target = users.find((u) => u.id === targetId);
      if (!target) {
        res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        return;
      }

      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const actor = req.authUser!;

      if ((target.isPrimaryAdmin || target.role === 'ADMIN') && actor.role !== 'ADMIN') {
        res.status(403).json({ error: 'Sistem yöneticisi hesapları yalnızca bir sistem yöneticisi tarafından düzenlenebilir.' });
        return;
      }

      if (VALID_ROLES.includes(body.role)) {
        if (body.role === 'ADMIN' && actor.role !== 'ADMIN') {
          res.status(403).json({ error: 'Yönetici (Admin) rolü yalnızca sistem yöneticisi tarafından atanabilir.' });
          return;
        }
        if (target.id === actor.id && body.role !== actor.role && actor.role !== 'ADMIN') {
          res.status(403).json({ error: 'Kendi rolünüzü yükseltemez veya değiştiremezsiniz.' });
          return;
        }
        if (target.isPrimaryAdmin && body.role !== 'ADMIN') {
          res.status(400).json({ error: 'Birincil sistem yöneticisinin rolü düşürülemez.' });
          return;
        }
      }

      if (typeof body.fullName === 'string') {
        const trimmedName = body.fullName.trim();
        if (trimmedName.length >= 2 && trimmedName.length <= 120) {
          target.fullName = trimmedName;
        }
      }
      if (typeof body.title === 'string') {
        const trimmedTitle = body.title.trim();
        if (trimmedTitle.length >= 1 && trimmedTitle.length <= 120) {
          target.title = trimmedTitle;
        }
      }
      if (typeof body.department === 'string' && body.department.trim().length >= 2 && body.department.trim().length <= 80) {
        target.department = body.department.trim();
      }
      if (body.linkedEmployeeId === null || typeof body.linkedEmployeeId === 'string') {
        target.linkedEmployeeId =
          typeof body.linkedEmployeeId === 'string' && body.linkedEmployeeId.trim()
            ? body.linkedEmployeeId.trim().slice(0, 80)
            : null;
      }

      if (VALID_ROLES.includes(body.role)) {
        target.role = body.role;
      }

      if (body.permissions && typeof body.permissions === 'object') {
        const nextPerms = sanitizePermissions(body.permissions, target.role);
        if (target.isPrimaryAdmin || target.id === actor.id) {
          nextPerms.modules.settings = true;
          nextPerms.actions.canManageUsers = true;
        }
        target.permissions = nextPerms;
      }

      if (typeof body.isActive === 'boolean') {
        if ((target.isPrimaryAdmin || target.id === actor.id) && !body.isActive) {
          res
            .status(400)
            .json({ error: 'Birincil yönetici veya mevcut oturumunuz pasif yapılamaz.' });
          return;
        }
        target.isActive = body.isActive;
        if (!target.isActive) {
          revokeUserSessions(target.id);
        }
      }

      if (typeof body.newPassword === 'string' && body.newPassword.length > 0) {
        if (body.newPassword.length < 8) {
          res.status(400).json({ error: 'Yeni şifre en az 8 karakter olmalıdır.' });
          return;
        }
        if (target.isPrimaryAdmin && getEnvAdminPassword().length > 0) {
          res.status(400).json({
            error:
              'Birincil yönetici şifresi ortam değişkeni (ADMIN_PASSWORD) ile yönetilmektedir.',
          });
          return;
        }
        target.passwordHash = hashPassword(body.newPassword);
        if (target.id !== actor.id) {
          revokeUserSessions(target.id);
        }
      }

      saveUsersToDisk(users);
      res.json({ user: toPublicUser(target) });
    }
  );

  // Delete member account
  app.delete(
    '/api/users/:id',
    requireAuth,
    requireUserManager,
    (req: AuthedRequest, res: Response) => {
      const targetId = req.params.id;
      const target = users.find((u) => u.id === targetId);
      if (!target) {
        res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        return;
      }
      if (target.isPrimaryAdmin || target.id === req.authUser!.id) {
        res
          .status(400)
          .json({ error: 'Birincil yönetici veya kendi hesabınız silinemez.' });
        return;
      }
      if (target.role === 'ADMIN' && req.authUser!.role !== 'ADMIN') {
        res
          .status(403)
          .json({ error: 'Sistem yöneticisi hesapları yalnızca sistem yöneticisi tarafından silinebilir.' });
        return;
      }
      users = users.filter((u) => u.id !== targetId);
      revokeUserSessions(targetId);
      saveUsersToDisk(users);
      res.json({ ok: true });
    }
  );

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
