import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { DbShape, FSNode, ShareRecord, SortDir, SortKey } from './types';

export const ROOT_DIR = path.join(process.cwd(), 'diskdata');
export const STORAGE_DIR = path.join(ROOT_DIR, 'files');
export const DB_FILE = path.join(ROOT_DIR, 'meta.json');

/** 每个账号的可用空间上限：500 MB */
export const QUOTA_BYTES = 500 * 1024 * 1024;

/** 旧数据（无 owner 字段）回退到的归属账号：默认管理员 */
export const DEFAULT_OWNER_FALLBACK = process.env.ADMIN_USER || 'admin';

/** 配额超限错误，由 saveFile 抛出，API 层捕获后返回 413 */
export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

function ensureDirs() {
  if (!fs.existsSync(ROOT_DIR)) fs.mkdirSync(ROOT_DIR, { recursive: true });
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const seed: DbShape = { nodes: [], shares: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf8');
  }
}

ensureDirs();

const EMPTY: DbShape = { nodes: [], shares: [] };

export async function readDb(): Promise<DbShape> {
  ensureDirs();
  try {
    const raw = await fsp.readFile(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as DbShape;
    if (!parsed || !Array.isArray(parsed.nodes)) return { nodes: [], shares: [] };
    if (!Array.isArray(parsed.shares)) parsed.shares = [];
    // 迁移：为历史节点补全 owner 字段
    let changed = false;
    for (const n of parsed.nodes) {
      if (!n.owner) {
        n.owner = DEFAULT_OWNER_FALLBACK;
        changed = true;
      }
    }
    if (changed) {
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
      } catch {
        /* 迁移失败不影响读取，下次写入会修正 */
      }
    }
    return parsed;
  } catch {
    return { nodes: [], shares: [] };
  }
}

/** 统计某账号已使用的文件总字节数 */
export function usedBytes(db: DbShape, owner: string): number {
  return db.nodes
    .filter((n) => n.owner === owner && n.type === 'file')
    .reduce((s, n) => s + n.size, 0);
}

// 简单的串行写锁，避免并发写坏 meta.json
let writeChain: Promise<unknown> = Promise.resolve();

export function withDb<T>(mutator: (db: DbShape) => T | Promise<T>): Promise<T> {
  const task = writeChain.then(async () => {
    const db = await readDb();
    const result = await mutator(db);
    const tmp = `${DB_FILE}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
    await fsp.rename(tmp, DB_FILE);
    return result;
  });
  writeChain = task.catch(() => undefined);
  return task;
}

export function newId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 20);
}

/** 同一父目录下生成不重名的名字 */
function uniqueName(db: DbShape, parentId: string | null, desired: string, excludeId?: string): string {
  const siblings = db.nodes.filter((n) => n.parentId === parentId && n.id !== excludeId);
  const taken = new Set(siblings.map((n) => n.name.toLowerCase()));
  if (!taken.has(desired.toLowerCase())) return desired;

  const dot = desired.lastIndexOf('.');
  const base = dot > 0 ? desired.slice(0, dot) : desired;
  const ext = dot > 0 ? desired.slice(dot) : '';
  for (let i = 1; i < 10000; i++) {
    const candidate = `${base}(${i})${ext}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${base}(${Date.now()})${ext}`;
}

export function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/^\.+/, '').trim() || '未命名';
}

export function sortNodes(nodes: FSNode[], key: SortKey, dir: SortDir): FSNode[] {
  const factor = dir === 'asc' ? 1 : -1;
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1; // 文件夹永远在前
    let cmp = 0;
    if (key === 'name') cmp = a.name.localeCompare(b.name, 'zh-Hans-CN');
    else if (key === 'size') cmp = a.size - b.size;
    else if (key === 'updatedAt') cmp = Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
    else cmp = 0;
    if (cmp === 0) cmp = a.name.localeCompare(b.name, 'zh-Hans-CN');
    return cmp * factor;
  });
}

export function getPath(db: DbShape, folderId: string | null): { id: string; name: string }[] {
  const chain: { id: string; name: string }[] = [];
  let cur = folderId ? db.nodes.find((n) => n.id === folderId && n.type === 'folder') : null;
  let guard = 0;
  while (cur && guard++ < 200) {
    chain.unshift({ id: cur.id, name: cur.name });
    cur = cur.parentId ? db.nodes.find((n) => n.id === cur!.parentId && n.type === 'folder') ?? null : null;
  }
  return chain;
}

/** 递归收集某个文件夹下的全部节点（含自身） */
export function collectSubtree(db: DbShape, id: string): FSNode[] {
  const out: FSNode[] = [];
  const target = db.nodes.find((n) => n.id === id);
  if (!target) return out;
  out.push(target);
  const walk = (parentId: string) => {
    for (const n of db.nodes.filter((x) => x.parentId === parentId)) {
      out.push(n);
      if (n.type === 'folder') walk(n.id);
    }
  };
  walk(id);
  return out;
}

export function isDescendant(db: DbShape, folderId: string, maybeAncestorId: string): boolean {
  let cur = db.nodes.find((n) => n.id === folderId);
  let guard = 0;
  while (cur?.parentId && guard++ < 200) {
    if (cur.parentId === maybeAncestorId) return true;
    cur = db.nodes.find((n) => n.id === cur!.parentId);
  }
  return false;
}

export async function createFolder(parentId: string | null, rawName: string, owner: string): Promise<FSNode> {
  const name = safeName(rawName);
  return withDb((db) => {
    const now = new Date().toISOString();
    const node: FSNode = {
      id: newId(),
      name: uniqueName(db, parentId, name),
      type: 'folder',
      parentId,
      owner,
      size: 0,
      mime: null,
      store: null,
      createdAt: now,
      updatedAt: now,
    };
    db.nodes.push(node);
    return node;
  });
}

export interface SaveFileInput {
  parentId: string | null;
  name: string;
  mime: string | null;
  buffer: Buffer;
  /** 所属账号（用于按账号隔离与配额校验） */
  owner: string;
}

export async function saveFile(input: SaveFileInput): Promise<FSNode> {
  const name = safeName(input.name);
  let store = '';
  let node!: FSNode;

  await withDb(async (db) => {
    const used = usedBytes(db, input.owner);
    if (used + input.buffer.byteLength > QUOTA_BYTES) {
      const remaining = Math.max(0, QUOTA_BYTES - used);
      throw new QuotaExceededError(
        `账号「${input.owner}」空间不足：已用 ${formatBytes(used)}，剩余 ${formatBytes(remaining)}，无法存入 ${formatBytes(input.buffer.byteLength)}`,
      );
    }

    const finalName = uniqueName(db, input.parentId, name);
    const ext = path.extname(finalName);
    store = `${newId()}${ext}`;
    await fsp.writeFile(path.join(STORAGE_DIR, store), input.buffer);

    const now = new Date().toISOString();
    node = {
      id: newId(),
      name: finalName,
      type: 'file',
      parentId: input.parentId,
      owner: input.owner,
      size: input.buffer.byteLength,
      mime: input.mime,
      store,
      createdAt: now,
      updatedAt: now,
    };
    db.nodes.push(node);
  });

  return node;
}

/** 轻量字节格式化，仅用于配额提示文案 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function renameNode(id: string, rawName: string): Promise<FSNode | null> {
  const name = safeName(rawName);
  return withDb((db) => {
    const node = db.nodes.find((n) => n.id === id);
    if (!node) return null;
    node.name = uniqueName(db, node.parentId, name, id);
    node.updatedAt = new Date().toISOString();
    return node;
  });
}

export async function moveNodes(ids: string[], targetId: string | null): Promise<number> {
  return withDb((db) => {
    let moved = 0;
    for (const id of ids) {
      const node = db.nodes.find((n) => n.id === id);
      if (!node) continue;
      if (node.parentId === targetId) continue;
      if (node.type === 'folder') {
        if (id === targetId) continue;
        if (targetId && isDescendant(db, targetId, id)) continue; // 不能移动到自己的子目录
      }
      node.name = uniqueName(db, targetId, node.name, node.id);
      node.parentId = targetId;
      node.updatedAt = new Date().toISOString();
      moved++;
    }
    return moved;
  });
}

export async function deleteNodes(ids: string[]): Promise<number> {
  let removed = 0;
  await withDb(async (db) => {
    const toDelete = new Set<string>();
    const files: string[] = [];
    for (const id of ids) {
      for (const n of collectSubtree(db, id)) {
        if (toDelete.has(n.id)) continue;
        toDelete.add(n.id);
        if (n.type === 'file' && n.store) files.push(n.store);
      }
    }
    db.nodes = db.nodes.filter((n) => !toDelete.has(n.id));
    removed = toDelete.size;
    for (const f of files) {
      try {
        await fsp.unlink(path.join(STORAGE_DIR, f));
      } catch {
        /* 文件可能已不存在，忽略 */
      }
    }
  });
  return removed;
}

/** 递归统计某个目录下所有文件的总大小与数量 */
export function folderStats(db: DbShape, folderId: string): { size: number; count: number } {
  const nodes = collectSubtree(db, folderId);
  const files = nodes.filter((n) => n.type === 'file');
  return { size: files.reduce((s, n) => s + n.size, 0), count: files.length };
}

/* ================= 分享链接 ================= */

/** 生成一个 16 字符的短分享 id */
export function shareId(): string {
  return randomBytes(8).toString('hex');
}

/** childId 是否为 rootId 自身或其后裔 */
export function isDescendantOrSelf(db: DbShape, childId: string, rootId: string): boolean {
  if (childId === rootId) return true;
  const child = db.nodes.find((n) => n.id === childId);
  if (!child) return false;
  return isDescendant(db, childId, rootId);
}

export interface CreateShareInput {
  nodeId: string;
  owner: string;
  /** 有效期天数：0 表示永久 */
  ttlDays: number;
}

export async function createShare(input: CreateShareInput): Promise<ShareRecord | null> {
  return withDb((db) => {
    const node = db.nodes.find((n) => n.id === input.nodeId);
    if (!node) return null;
    const now = new Date();
    const expireAt =
      input.ttlDays > 0 ? new Date(now.getTime() + input.ttlDays * 86_400_000).toISOString() : null;
    const rec: ShareRecord = {
      id: shareId(),
      nodeId: input.nodeId,
      owner: input.owner,
      createdAt: now.toISOString(),
      expireAt,
    };
    db.shares.push(rec);
    return rec;
  });
}

/** 在已读取的 db 上取分享记录，并校验未过期、节点仍存在 */
export function getShare(db: DbShape, id: string): ShareRecord | null {
  const s = db.shares.find((x) => x.id === id);
  if (!s) return null;
  if (s.expireAt && Date.parse(s.expireAt) < Date.now()) return null;
  const node = db.nodes.find((n) => n.id === s.nodeId);
  if (!node) return null;
  return s;
}

export async function listShares(owner?: string): Promise<ShareRecord[]> {
  const db = await readDb();
  let list = db.shares;
  if (owner) list = list.filter((s) => s.owner === owner);
  return list.filter((s) => !s.expireAt || Date.parse(s.expireAt) >= Date.now());
}

export async function revokeShare(id: string, owner?: string): Promise<number> {
  return withDb((db) => {
    const before = db.shares.length;
    db.shares = db.shares.filter((s) => !(s.id === id && (!owner || s.owner === owner)));
    return before - db.shares.length;
  });
}

export const EMPTY_DB = EMPTY;
