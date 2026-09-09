import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { ROOT_DIR } from './store';

const FILE = path.join(ROOT_DIR, 'sessions.json');
const MAX_SESSIONS = 200;

export interface SessionRecord {
  id: string;
  username: string;
  role: 'admin' | 'user';
  /** 令牌过期时间（ISO） */
  expAt: string;
  createdAt: string;
  lastSeenAt: string;
  ip: string;
  ua: string;
}

async function readAll(): Promise<SessionRecord[]> {
  try {
    const raw = await fsp.readFile(FILE, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as SessionRecord[]) : [];
  } catch {
    return [];
  }
}

let chain: Promise<unknown> = Promise.resolve();

function withSessions<T>(mutator: (list: SessionRecord[]) => T | Promise<T>): Promise<T> {
  const task = chain.then(async () => {
    const list = await readAll();
    const result = await mutator(list);
    if (!fs.existsSync(ROOT_DIR)) fs.mkdirSync(ROOT_DIR, { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(list, null, 2), 'utf8');
    await fsp.rename(tmp, FILE);
    return result;
  });
  chain = task.catch(() => undefined);
  return task;
}

export interface CreateSessionInput {
  username: string;
  role: 'admin' | 'user';
  expAt: string;
  ip: string;
  ua: string;
}

export function createSession(input: CreateSessionInput): Promise<SessionRecord> {
  const rec: SessionRecord = {
    id: randomUUID(),
    username: input.username,
    role: input.role,
    expAt: input.expAt,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    ip: input.ip,
    ua: input.ua,
  };
  return withSessions((list) => {
    // 先清理过期会话，再控制总量
    const now = Date.now();
    const alive = list.filter((s) => Date.parse(s.expAt) > now);
    alive.unshift(rec);
    list.length = 0;
    list.push(...alive.slice(0, MAX_SESSIONS));
    return rec;
  });
}

export async function getSession(id: string): Promise<SessionRecord | null> {
  const list = await readAll();
  const rec = list.find((s) => s.id === id);
  if (!rec) return null;
  if (Date.parse(rec.expAt) <= Date.now()) return null;
  return rec;
}

/** 列出全部未过期会话（含已登录用户信息） */
export async function listSessions(): Promise<SessionRecord[]> {
  const now = Date.now();
  return (await readAll())
    .filter((s) => Date.parse(s.expAt) > now)
    .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt));
}

/** 更新最后活跃时间，默认节流 30 秒，避免频繁写盘 */
export function touchSession(id: string, throttleMs = 30_000): void {
  void withSessions((list) => {
    const rec = list.find((s) => s.id === id);
    if (!rec) return;
    const now = Date.now();
    if (now - Date.parse(rec.lastSeenAt) < throttleMs) return;
    rec.lastSeenAt = new Date(now).toISOString();
  }).catch(() => undefined);
}

export function revokeSession(id: string): Promise<void> {
  return withSessions((list) => {
    const idx = list.findIndex((s) => s.id === id);
    if (idx >= 0) list.splice(idx, 1);
  });
}

export function revokeSessions(ids: string[]): Promise<number> {
  const set = new Set(ids);
  return withSessions((list) => {
    const before = list.length;
    const kept = list.filter((s) => !set.has(s.id));
    list.length = 0;
    list.push(...kept);
    return before - kept.length;
  });
}

export function revokeAllExcept(id: string): Promise<number> {
  return withSessions((list) => {
    const before = list.length;
    const kept = list.filter((s) => s.id === id);
    list.length = 0;
    list.push(...kept);
    return before - kept.length;
  });
}

export function revokeByUser(username: string): Promise<number> {
  return withSessions((list) => {
    const before = list.length;
    const kept = list.filter((s) => s.username !== username);
    list.length = 0;
    list.push(...kept);
    return before - kept.length;
  });
}
