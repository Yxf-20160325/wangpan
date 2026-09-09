import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { ROOT_DIR } from './store';

const LOG_FILE = path.join(ROOT_DIR, 'logs.json');
const MAX_LOGS = 2000;

export type LogAction =
  | 'login'
  | 'logout'
  | 'upload'
  | 'create'
  | 'rename'
  | 'move'
  | 'delete'
  | 'download'
  | 'setting';

export const ACTION_LABEL: Record<LogAction, string> = {
  login: '登录',
  logout: '退出登录',
  upload: '上传文件',
  create: '新建文件夹',
  rename: '重命名',
  move: '移动',
  delete: '删除',
  download: '下载',
  setting: '账号设置',
};

export interface LogEntry {
  id: string;
  ts: string;
  action: LogAction;
  actionLabel: string;
  target: string;
  detail: string;
  result: 'ok' | 'fail';
  user: string;
}

async function readAll(): Promise<LogEntry[]> {
  try {
    const raw = await fsp.readFile(LOG_FILE, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as LogEntry[]) : [];
  } catch {
    return [];
  }
}

let chain: Promise<unknown> = Promise.resolve();

export function appendLog(entry: {
  action: LogAction;
  target: string;
  detail?: string;
  result?: 'ok' | 'fail';
  user?: string;
}): void {
  const task = chain.then(async () => {
    try {
      const all = await readAll();
      all.unshift({
        id: randomUUID(),
        ts: new Date().toISOString(),
        action: entry.action,
        actionLabel: ACTION_LABEL[entry.action] ?? entry.action,
        target: entry.target || '-',
        detail: entry.detail ?? '',
        result: entry.result ?? 'ok',
        user: entry.user ?? 'admin',
      });
      const trimmed = all.slice(0, MAX_LOGS);
      if (!fs.existsSync(ROOT_DIR)) fs.mkdirSync(ROOT_DIR, { recursive: true });
      const tmp = `${LOG_FILE}.${process.pid}.tmp`;
      await fsp.writeFile(tmp, JSON.stringify(trimmed, null, 2), 'utf8');
      await fsp.rename(tmp, LOG_FILE);
    } catch {
      /* 日志失败不影响主流程 */
    }
  });
  chain = task.catch(() => undefined);
}

export async function getLogs(): Promise<LogEntry[]> {
  return readAll();
}

export async function clearLogs(): Promise<void> {
  const task = chain.then(async () => {
    if (!fs.existsSync(ROOT_DIR)) fs.mkdirSync(ROOT_DIR, { recursive: true });
    const tmp = `${LOG_FILE}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, '[]', 'utf8');
    await fsp.rename(tmp, LOG_FILE);
  });
  chain = task.catch(() => undefined);
  return task;
}
