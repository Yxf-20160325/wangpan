import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ROOT_DIR } from './store';
import { SESSION_COOKIE, verifyToken } from './session';
import { getSession, revokeByUser, type SessionRecord } from './session-store';
import type { PermissionKey } from './permissions';
import { ALL_PERMISSIONS } from './permissions';

export const DEFAULT_USERNAME = process.env.ADMIN_USER || 'admin';
export const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'Yxf20160325';

const USERS_FILE = path.join(ROOT_DIR, 'users.json');
const SETTINGS_FILE = path.join(ROOT_DIR, 'settings.json');

export type Role = 'admin' | 'user';

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  role: Role;
  /** 头像：data URL（base64 图片）或空（使用首字母占位） */
  avatar?: string;
  createdAt: string;
  /** 是否已封禁 */
  banned?: boolean;
  /** 封禁原因 */
  banReason?: string;
  /** 封禁到期时间（ISO 字符串）；null/undefined 表示永久封禁 */
  banExpiresAt?: string | null;
  /** 管理面板细粒度权限点；仅 role==='admin' 时生效。undefined/空 视为拥有全部权限（兼容老账号）。 */
  permissions?: PermissionKey[];
}

export interface AppSettings {
  /** 是否开放新用户注册 */
  allowRegister: boolean;
  /** 是否开放登录；false 时所有账号（含管理员）都无法登录 */
  allowLogin: boolean;
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/* ---------------- 全局设置 ---------------- */

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await fsp.readFile(SETTINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      allowRegister: parsed.allowRegister !== false,
      allowLogin: parsed.allowLogin !== false,
    };
  } catch {
    return { allowRegister: true, allowLogin: true };
  }
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const cur = await getSettings();
  const next = { ...cur, ...patch };
  if (!fs.existsSync(ROOT_DIR)) fs.mkdirSync(ROOT_DIR, { recursive: true });
  const tmp = `${SETTINGS_FILE}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(next, null, 2), 'utf8');
  await fsp.rename(tmp, SETTINGS_FILE);
  return next;
}

/* ---------------- 用户存储 ---------------- */

async function readUsers(): Promise<UserRecord[]> {
  try {
    const raw = await fsp.readFile(USERS_FILE, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as UserRecord[]) : [];
  } catch {
    return [];
  }
}

let chain: Promise<unknown> = Promise.resolve();

function withUsers<T>(mutator: (users: UserRecord[]) => T | Promise<T>): Promise<T> {
  const task = chain.then(async () => {
    const users = await readUsers();
    const result = await mutator(users);
    if (!fs.existsSync(ROOT_DIR)) fs.mkdirSync(ROOT_DIR, { recursive: true });
    const tmp = `${USERS_FILE}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(users, null, 2), 'utf8');
    await fsp.rename(tmp, USERS_FILE);
    return result;
  });
  chain = task.catch(() => undefined);
  return task;
}

/** 读取用户列表；首次运行时用默认管理员账号初始化，并迁移旧的 settings.json 凭据 */
export async function listUsers(): Promise<UserRecord[]> {
  const users = await readUsers();
  if (users.length) return users;

  let username = DEFAULT_USERNAME;
  let hash: string | null = null;
  try {
    const raw = await fsp.readFile(SETTINGS_FILE, 'utf8');
    const old = JSON.parse(raw) as { username?: string; passwordHash?: string | null };
    if (old.username) username = old.username;
    if (old.passwordHash) hash = old.passwordHash;
  } catch {
    /* 没有旧配置，使用默认账号 */
  }

  const admin: UserRecord = {
    id: randomUUID(),
    username,
    passwordHash: hash ?? (await sha256(DEFAULT_PASSWORD)),
    role: 'admin',
    createdAt: new Date().toISOString(),
  };
  await withUsers((u) => {
    u.push(admin);
  });
  return readUsers();
}

export async function findUser(username: string): Promise<UserRecord | null> {
  const users = await listUsers();
  const key = username.trim();
  return users.find((u) => u.username === key) ?? null;
}

export async function verifyLogin(username: string, password: string): Promise<UserRecord | null> {
  const user = await findUser(username);
  if (!user) return null;
  return (await sha256(password)) === user.passwordHash ? user : null;
}

/** 当前是否处于有效封禁状态（永久封禁或限时封禁未到期都算） */
export function isBannedNow(u: UserRecord): boolean {
  if (!u.banned) return false;
  if (u.banExpiresAt && Date.parse(u.banExpiresAt) <= Date.now()) return false;
  return true;
}

/** 将封禁字段归一化为「当前有效」状态（限时已过则视为未封禁，避免残留标记） */
export function normalizeBan(u: UserRecord): Pick<UserRecord, 'banned' | 'banReason' | 'banExpiresAt'> {
  if (isBannedNow(u)) {
    return { banned: true, banReason: u.banReason, banExpiresAt: u.banExpiresAt ?? null };
  }
  return { banned: false, banReason: undefined, banExpiresAt: undefined };
}

/**
 * 计算用户「实际拥有的权限点」。
 * - 非管理员：空（无法进入管理面板）。
 * - 管理员但 permissions 为空 / 未设置：视为拥有全部权限（兼容老账号）。
 * - 管理员且设置了 permissions：以设置为准（过滤掉未知的脏数据）。
 */
export function effectivePermissions(u: UserRecord): PermissionKey[] {
  if (u.role !== 'admin') return [];
  if (!u.permissions || u.permissions.length === 0) return [...ALL_PERMISSIONS];
  const allow = new Set<string>(ALL_PERMISSIONS);
  return u.permissions.filter((p) => allow.has(p));
}

/** 当前用户是否拥有某权限点（含角色与封禁判断） */
export function hasPerm(u: UserRecord, key: PermissionKey): boolean {
  if (isBannedNow(u)) return false;
  return effectivePermissions(u).includes(key);
}

/** 封禁账号：永久（durationDays=0）或限时（N 天）；同时撤销其全部会话 */
export async function banUser(id: string, reason: string, durationDays: number): Promise<UserRecord> {
  const expiresAt = durationDays > 0 ? new Date(Date.now() + durationDays * 86_400_000).toISOString() : null;
  const updated = await withUsers((users) => {
    const user = users.find((u) => u.id === id);
    if (!user) throw new AuthError('用户不存在');
    user.banned = true;
    user.banReason = reason || '违反使用规范';
    user.banExpiresAt = expiresAt;
    return { ...user };
  });
  const u = await findUser(updated.username);
  if (u) await revokeByUser(u.username);
  return updated;
}

/** 解封账号 */
export async function unbanUser(id: string): Promise<UserRecord> {
  return withUsers((users) => {
    const user = users.find((u) => u.id === id);
    if (!user) throw new AuthError('用户不存在');
    user.banned = false;
    user.banReason = undefined;
    user.banExpiresAt = undefined;
    return { ...user };
  });
}

export class AuthError extends Error {}

export async function createUser(input: {
  username: string;
  password: string;
  role?: Role;
  permissions?: PermissionKey[];
}): Promise<UserRecord> {
  const username = input.username.trim();
  if (username.length < 2 || username.length > 24) throw new AuthError('用户名长度需在 2-24 个字符之间');
  if (!/^[\w一-龥.\-@]+$/.test(username)) throw new AuthError('用户名只能包含中英文、数字、下划线、点、短横线或 @');
  if (input.password.length < 6) throw new AuthError('密码至少需要 6 位');

  const users = await listUsers();
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    throw new AuthError('该用户名已被注册');
  }

  const role = input.role ?? 'user';
  // 普通用户无管理面板权限；管理员默认全权，除非显式指定
  const permissions =
    role === 'user' ? [] : input.permissions?.length ? input.permissions.filter((p) => ALL_PERMISSIONS.includes(p)) : [...ALL_PERMISSIONS];

  const record: UserRecord = {
    id: randomUUID(),
    username,
    passwordHash: await sha256(input.password),
    role,
    createdAt: new Date().toISOString(),
    permissions,
  };

  await withUsers((u) => {
    u.push(record);
  });
  return record;
}

export async function updateUser(
  id: string,
  patch: { username?: string; password?: string; role?: Role; permissions?: PermissionKey[] },
): Promise<UserRecord> {
  const hash = patch.password ? await sha256(patch.password) : null;

  return withUsers((users) => {
    const user = users.find((u) => u.id === id);
    if (!user) throw new AuthError('用户不存在');

    if (patch.username !== undefined) {
      const name = patch.username.trim();
      if (name.length < 2 || name.length > 24) throw new AuthError('用户名长度需在 2-24 个字符之间');
      if (users.some((u) => u.id !== id && u.username.toLowerCase() === name.toLowerCase())) {
        throw new AuthError('该用户名已存在');
      }
      user.username = name;
    }
    if (hash) user.passwordHash = hash;

    // 角色变更：同步权限（普通用户无管理权限；管理员默认全权）
    if (patch.role !== undefined && patch.role !== user.role) {
      if (user.role === 'admin' && users.filter((u) => u.role === 'admin').length <= 1) {
        throw new AuthError('至少需要保留一个管理员');
      }
      user.role = patch.role;
      user.permissions = patch.role === 'user' ? [] : patch.permissions?.length ? patch.permissions.filter((p) => ALL_PERMISSIONS.includes(p)) : [...ALL_PERMISSIONS];
    } else if (patch.permissions !== undefined && user.role === 'admin') {
      // 角色未变但显式调整权限（仅对管理员有意义）
      user.permissions = patch.permissions.length ? patch.permissions.filter((p) => ALL_PERMISSIONS.includes(p)) : [];
    }

    return { ...user };
  });
}

/** 单独设置某用户的权限点（用于「管理用户权限」）。仅对管理员生效，普通用户强制为空。 */
export async function setUserPermissions(id: string, permissions: PermissionKey[]): Promise<UserRecord> {
  return withUsers((users) => {
    const user = users.find((u) => u.id === id);
    if (!user) throw new AuthError('用户不存在');
    const next = permissions.filter((p) => ALL_PERMISSIONS.includes(p));
    user.permissions = user.role === 'admin' ? next : [];
    return { ...user };
  });
}

export async function deleteUser(id: string): Promise<void> {
  await withUsers((users) => {
    const user = users.find((u) => u.id === id);
    if (!user) throw new AuthError('用户不存在');
    if (user.role === 'admin' && users.filter((u) => u.role === 'admin').length <= 1) {
      throw new AuthError('至少需要保留一个管理员');
    }
    const idx = users.findIndex((u) => u.id === id);
    if (idx >= 0) users.splice(idx, 1);
  });
}

/* ---------------- 自服务（当前登录用户） ---------------- */

export interface OwnAccountPatch {
  /** 当前密码，用于身份验证 */
  currentPassword: string;
  /** 新用户名（留空则不改） */
  username?: string;
  /** 新密码（留空则不改） */
  password?: string;
  /** 头像 data URL（传 null 表示清除头像） */
  avatar?: string | null;
}

/** 仅更新头像，无需当前密码（已通过会话鉴权） */
export async function updateOwnAvatar(username: string, avatar: string | null): Promise<void> {
  const user = await findUser(username);
  if (!user) throw new AuthError('用户不存在');
  await withUsers((users) => {
    const target = users.find((u) => u.id === user.id);
    if (!target) throw new AuthError('用户不存在');
    target.avatar = avatar ?? undefined;
  });
}

/**
 * 修改当前登录用户的资料（头像 / 用户名 / 密码）。
 * 校验当前密码；若仅改头像则不触碰密码。
 */
export async function updateOwnAccount(username: string, patch: OwnAccountPatch): Promise<void> {
  const user = await findUser(username);
  if (!user) throw new AuthError('用户不存在');
  if (!(await verifyLogin(user.username, patch.currentPassword))) {
    throw new AuthError('当前密码不正确');
  }

  await withUsers((users) => {
    const target = users.find((u) => u.id === user.id);
    if (!target) throw new AuthError('用户不存在');

    if (patch.avatar !== undefined) {
      target.avatar = patch.avatar ?? undefined;
    }
    if (patch.username && patch.username.trim() && patch.username.trim() !== target.username) {
      const name = patch.username.trim();
      if (name.length < 2 || name.length > 24) throw new AuthError('用户名长度需在 2-24 个字符之间');
      if (users.some((u) => u.id !== target.id && u.username.toLowerCase() === name.toLowerCase())) {
        throw new AuthError('该用户名已存在');
      }
      target.username = name;
    }
    if (patch.password) {
      if (patch.password.length < 6) throw new AuthError('新密码至少需要 6 位');
      target.passwordHash = sha256Sync(patch.password);
    }
  });
}

/** 同步版 sha256，用于本进程内的快速校验（与 Web Crypto 版本输出一致） */
function sha256Sync(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * 注销当前登录用户账号。
 * 校验当前密码，删除账号并撤销其全部会话。不允许删除最后一个管理员。
 */
export async function deleteOwnAccount(username: string, currentPassword: string): Promise<void> {
  const user = await findUser(username);
  if (!user) throw new AuthError('用户不存在');
  if (!(await verifyLogin(user.username, currentPassword))) {
    throw new AuthError('当前密码不正确');
  }

  const users = await listUsers();
  if (
    user.role === 'admin' &&
    users.filter((u) => u.role === 'admin').length <= 1
  ) {
    throw new AuthError('至少需要保留一个管理员，无法注销');
  }

  await withUsers((list) => {
    const idx = list.findIndex((u) => u.id === user.id);
    if (idx >= 0) list.splice(idx, 1);
  });
  await revokeByUser(user.username);
}

/* ---------------- 当前会话 ---------------- */

export async function currentUser(): Promise<string> {
  try {
    const store = await cookies();
    const s = await verifyToken(store.get(SESSION_COOKIE)?.value);
    return s?.u ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function currentUserRecord(): Promise<UserRecord | null> {
  return findUser(await currentUser());
}

/** 管理员校验：非管理员或 403 时返回 null */
export async function requireAdminRecord(): Promise<UserRecord | null> {
  const rec = await currentUserRecord();
  return rec && rec.role === 'admin' ? rec : null;
}

/* ---------------- 会话 ---------------- */

/** 当前请求对应的服务端会话；会话被踢出或令牌过期时返回 null */
export async function currentSession(): Promise<SessionRecord | null> {
  try {
    const store = await cookies();
    const payload = await verifyToken(store.get(SESSION_COOKIE)?.value);
    if (!payload) return null;
    return await getSession(payload.sid);
  } catch {
    return null;
  }
}

/** API 守卫：未登录/会话失效时返回 401 响应，否则返回 null */
export async function guardApi(): Promise<NextResponse | null> {
  const session = await currentSession();
  if (session) return null;
  return NextResponse.json({ error: '未登录或会话已失效', code: 'UNAUTHORIZED' }, { status: 401 });
}

/** 管理员守卫：无权限时返回 403 响应，否则返回当前会话 */
export async function guardAdminApi(): Promise<{ session: SessionRecord } | NextResponse> {
  const session = await currentSession();
  if (!session) {
    return NextResponse.json({ error: '未登录或会话已失效', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (session.role !== 'admin') {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  }
  return { session };
}

/**
 * 细粒度权限守卫：需为管理员且拥有指定权限点，否则返回 401/403。
 * 返回 `{ rec }`（当前用户记录）以便路由使用其 username 等字段。
 */
export async function requirePermission(
  key: PermissionKey,
): Promise<{ rec: UserRecord } | NextResponse> {
  const rec = await currentUserRecord();
  if (!rec) {
    return NextResponse.json({ error: '未登录或会话已失效', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (rec.role !== 'admin') {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  }
  if (!hasPerm(rec, key)) {
    return NextResponse.json({ error: '无权限执行此操作', code: 'FORBIDDEN' }, { status: 403 });
  }
  return { rec };
}
