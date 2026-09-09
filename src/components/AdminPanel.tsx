'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import FileIcon from './FileIcon';
import { ConfirmDialog } from './Dialogs';
import {
  IconAlert,
  IconChart,
  IconCloud,
  IconDownload,
  IconEye,
  IconHome,
  IconLogout,
  IconMonitor,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconShare,
  IconShield,
  IconTrash,
  IconUser,
} from './Icons';
import { UsersTab, SettingsTab } from './AdminSettings';
import { formatSize, formatTime } from '@/lib/format';
import { kindOf } from '@/lib/fileKind';
import { api } from '@/lib/clientApi';
import type { FSNodeView } from '@/lib/types';

type Tab = 'overview' | 'files' | 'logs' | 'sessions' | 'shares' | 'users' | 'settings';

interface AdminItem extends FSNodeView {
  path: string;
  ext: string;
  owner: string;
}

interface AccountUsage {
  username: string;
  role: 'admin' | 'user';
  used: number;
  quota: number;
  fileCount: number;
  folderCount: number;
}

interface LogEntry {
  id: string;
  ts: string;
  action: string;
  actionLabel: string;
  target: string;
  detail: string;
  result: 'ok' | 'fail';
  user: string;
}

interface SessionItem {
  id: string;
  username: string;
  role: 'admin' | 'user';
  ip: string;
  ua: string;
  createdAt: string;
  lastSeenAt: string;
  expAt: string;
  current: boolean;
}

interface UserItem {
  id: string;
  username: string;
  role: 'admin' | 'user';
  createdAt: string;
}

interface Overview {
  fileCount: number;
  folderCount: number;
  totalSize: number;
  logCount: number;
  lastLogin: string | null;
  largest: { id: string; name: string; size: number; path: string }[];
  recent: { id: string; name: string; size: number; createdAt: string; path: string }[];
  byExt: { ext: string; count: number; size: number }[];
  byUser: AccountUsage[];
}

const MENU: { key: Tab; label: string; icon: typeof IconChart }[] = [
  { key: 'overview', label: '概览', icon: IconChart },
  { key: 'files', label: '全局文件', icon: IconHome },
  { key: 'logs', label: '操作日志', icon: IconShield },
  { key: 'sessions', label: '登录会话', icon: IconMonitor },
  { key: 'shares', label: '分享管理', icon: IconShare },
  { key: 'users', label: '用户', icon: IconUser },
  { key: 'settings', label: '设置', icon: IconSettings },
];

export default function AdminPanel({ user }: { user: string }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [items, setItems] = useState<AdminItem[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [ov, setOv] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [allowRegister, setAllowRegister] = useState(true);
  const [allowLogin, setAllowLogin] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  const notify = useCallback((text: string, ok = true) => {
    setToast({ text, ok });
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, l, s, o, u] = await Promise.all([
        api('/api/admin/files').then((r) => r.json()),
        api('/api/admin/logs').then((r) => r.json()),
        api('/api/admin/sessions').then((r) => r.json()),
        api('/api/admin/overview').then((r) => r.json()),
        api('/api/admin/users').then((r) => r.json()),
      ]);
      setItems(f.items ?? []);
      setAccounts(f.accounts ?? []);
      setLogs(l.logs ?? []);
      setSessions(s.sessions ?? []);
      setOv(o ?? null);
      setUsers(u.users ?? []);
      setAllowRegister(u.settings?.allowRegister !== false);
      setAllowLogin(u.settings?.allowLogin !== false);
    } catch {
      notify('加载失败', false);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const deleteItems = async (ids: string[]) => {
    const res = await api('/api/admin/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return notify(d.error || '删除失败', false);
    notify(`已删除 ${d.removed ?? ids.length} 个节点`);
    load();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6f7f9] text-slate-900">
      {/* 侧边栏 */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4 md:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
            <IconShield width={19} height={19} />
          </span>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold">管理面板</p>
            <p className="text-xs text-slate-400">Administrator</p>
          </div>
        </div>

        <nav className="space-y-0.5">
          {MENU.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                onClick={() => setTab(m.key)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  tab === m.key ? 'bg-slate-900 font-medium text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon width={17} height={17} />
                {m.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-1">
          <button
            onClick={() => (window.location.href = '/')}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            <IconCloud width={17} height={17} /> 返回网盘
          </button>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <IconLogout width={17} height={17} /> 退出登录
          </button>
        </div>
      </aside>

      {/* 主区 */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-3.5">
          <div>
            <h1 className="text-[15px] font-semibold">{MENU.find((m) => m.key === tab)?.label}</h1>
            <p className="text-xs text-slate-400">
              {loading ? '加载中…' : `${items.length} 个节点 · ${logs.length} 条日志`}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600 sm:flex">
              <IconUser width={14} height={14} /> {user}
            </span>
            <button onClick={load} className="btn-ghost p-2" title="刷新">
              <IconRefresh width={16} height={16} />
            </button>
            <button onClick={() => (window.location.href = '/')} className="btn-outline">
              <IconCloud width={16} height={16} /> 网盘
            </button>
            <button onClick={logout} className="btn-outline text-red-600 hover:bg-red-50">
              <IconLogout width={16} height={16} /> 退出
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          {tab === 'overview' && <OverviewTab ov={ov} />}
          {tab === 'files' && <FilesTab items={items} accounts={accounts} onDelete={deleteItems} notify={notify} user={user} />}
          {tab === 'logs' && <LogsTab logs={logs} onReload={load} notify={notify} />}
          {tab === 'sessions' && <SessionsTab sessions={sessions} onReload={load} notify={notify} />}
          {tab === 'shares' && <SharesTab notify={notify} onReload={load} />}
          {tab === 'users' && <UsersTab users={users} current={user} onReload={load} notify={notify} />}
          {tab === 'settings' && (
            <SettingsTab
              user={user}
              allowRegister={allowRegister}
              allowLogin={allowLogin}
              onReload={load}
              notify={notify}
            />
          )}
        </div>
      </main>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm text-white shadow-pop anim-pop ${
            toast.ok ? 'bg-slate-900' : 'bg-red-600'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

/* ---------------- 概览 ---------------- */

function OverviewTab({ ov }: { ov: Overview | null }) {
  if (!ov) return <p className="p-6 text-sm text-slate-400">加载中…</p>;
  const maxExt = Math.max(1, ...ov.byExt.map((b) => b.size));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="文件总数" value={`${ov.fileCount}`} hint={`${ov.folderCount} 个文件夹`} />
        <StatCard label="占用空间" value={formatSize(ov.totalSize)} hint="全部文件合计" />
        <StatCard label="操作日志" value={`${ov.logCount}`} hint="最多保留 2000 条" />
        <StatCard label="最近登录" value={ov.lastLogin ? formatTime(ov.lastLogin).slice(5, 16) : '—'} hint="成功登录时间" />
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">各账号空间使用（每个账号上限 {formatSize(ov.byUser[0]?.quota ?? 500 * 1024 * 1024)}）</h2>
        {ov.byUser.length === 0 ? (
          <p className="text-sm text-slate-400">暂无账号</p>
        ) : (
          <div className="space-y-3">
            {ov.byUser.map((u) => {
              const pct = Math.min(100, (u.used / u.quota) * 100);
              return (
                <div key={u.username}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-slate-700">
                      {u.username}
                      {u.role === 'admin' && (
                        <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">管理员</span>
                      )}
                    </span>
                    <span className="text-slate-400">
                      {formatSize(u.used)} / {formatSize(u.quota)} · {u.fileCount} 文件 / {u.folderCount} 夹
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${pct > 90 ? 'bg-red-500' : 'bg-brand-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">文件类型分布（按占用）</h2>
          {ov.byExt.length === 0 ? (
            <p className="text-sm text-slate-400">暂无数据</p>
          ) : (
            <div className="space-y-2.5">
              {ov.byExt.map((b) => (
                <div key={b.ext}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium uppercase text-slate-600">.{b.ext}</span>
                    <span className="text-slate-400">
                      {b.count} 个 · {formatSize(b.size)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(b.size / maxExt) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">占用最大的文件</h2>
          {ov.largest.length === 0 ? (
            <p className="text-sm text-slate-400">暂无数据</p>
          ) : (
            <ul className="space-y-2.5">
              {ov.largest.map((f) => (
                <li key={f.id} className="flex items-center gap-3">
                  <FileIcon kind={kindOf(f.name, 'file')} name={f.name} size={28} rounded="rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-800">{f.name}</p>
                    <p className="truncate text-xs text-slate-400">{f.path || '全部文件'}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-slate-600">{formatSize(f.size)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">最近上传</h2>
        {ov.recent.length === 0 ? (
          <p className="text-sm text-slate-400">暂无数据</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="pb-2 font-medium">名称</th>
                  <th className="pb-2 font-medium">位置</th>
                  <th className="pb-2 font-medium">大小</th>
                  <th className="pb-2 font-medium">上传时间</th>
                </tr>
              </thead>
              <tbody>
                {ov.recent.map((f) => (
                  <tr key={f.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-2">
                        <FileIcon kind={kindOf(f.name, 'file')} name={f.name} size={24} rounded="rounded-md" />
                        <span className="truncate">{f.name}</span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-slate-500">{f.path || '全部文件'}</td>
                    <td className="py-2.5 pr-3 text-xs text-slate-500">{formatSize(f.size)}</td>
                    <td className="py-2.5 text-xs text-slate-400">{formatTime(f.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1.5 text-xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

/* ---------------- 全局文件 ---------------- */

function FilesTab({
  items,
  accounts,
  onDelete,
  notify,
  user,
}: {
  items: AdminItem[];
  accounts: string[];
  onDelete: (ids: string[]) => void;
  notify: (t: string, ok?: boolean) => void;
  user: string;
}) {
  const [kw, setKw] = useState('');
  const [type, setType] = useState<'all' | 'file' | 'folder'>('all');
  const [account, setAccount] = useState<string>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<string[] | null>(null);

  const list = useMemo(() => {
    const k = kw.trim().toLowerCase();
    return items.filter((n) => {
      if (account !== 'all' && n.owner !== account) return false;
      if (type !== 'all' && n.type !== type) return false;
      if (!k) return true;
      return n.name.toLowerCase().includes(k) || n.path.toLowerCase().includes(k);
    });
  }, [items, kw, type, account]);

  const download = (n: AdminItem) => {
    const a = document.createElement('a');
    a.href = `/api/raw/${n.id}?d=1`;
    a.download = n.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <IconSearch width={15} height={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="搜索名称或所在目录…"
            className="w-64 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'all' | 'file' | 'folder')}
          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-brand-400"
        >
          <option value="all">全部类型</option>
          <option value="file">仅文件</option>
          <option value="folder">仅文件夹</option>
        </select>
        <select
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-brand-400"
        >
          <option value="all">全部账号</option>
          {accounts.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        {selected.length > 0 ? (
          <button
            className="btn bg-red-600 text-white hover:bg-red-700"
            onClick={() => setConfirm(selected)}
          >
            <IconTrash width={15} height={15} /> 删除所选（{selected.length}）
          </button>
        ) : (
          <span className="text-sm text-slate-400">共 {list.length} 项</span>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs text-slate-500">
              <th className="w-9 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={selected.length > 0 && selected.length === list.length}
                  onChange={(e) => setSelected(e.target.checked ? list.map((n) => n.id) : [])}
                />
              </th>
              <th className="py-2.5 font-medium">名称</th>
              <th className="w-24 py-2.5 font-medium">类型</th>
              <th className="w-24 py-2.5 text-right font-medium">大小</th>
              <th className="w-44 py-2.5 font-medium">所在目录</th>
              <th className="w-28 py-2.5 font-medium">所属账号</th>
              <th className="w-36 py-2.5 font-medium">修改时间</th>
              <th className="w-24 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-sm text-slate-400">
                  没有匹配的条目
                </td>
              </tr>
            ) : (
              list.map((n) => (
                <tr key={n.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.includes(n.id)}
                      onChange={(e) =>
                        setSelected((s) => (e.target.checked ? [...s, n.id] : s.filter((x) => x !== n.id)))
                      }
                    />
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2">
                      <FileIcon kind={kindOf(n.name, n.type)} name={n.name} size={26} rounded="rounded-md" />
                      <span className="truncate text-slate-800" title={n.name}>
                        {n.name}
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 text-xs uppercase text-slate-500">{n.type === 'folder' ? '文件夹' : n.ext || '-'}</td>
                  <td className="py-2.5 text-right text-xs text-slate-500">
                    {n.type === 'folder' ? `${n.itemCount ?? 0} 项` : formatSize(n.size)}
                  </td>
                  <td className="truncate py-2.5 pr-3 text-xs text-slate-500" title={n.path}>
                    {n.path || '全部文件'}
                  </td>
                  <td className="py-2.5 text-xs font-medium text-slate-600">
                    {n.owner}
                    {n.owner === user && <span className="ml-1 text-[10px] font-normal text-brand-600">(我)</span>}
                  </td>
                  <td className="py-2.5 text-xs text-slate-400">{formatTime(n.updatedAt)}</td>
                  <td className="py-2.5 text-right">
                    <span className="inline-flex gap-1">
                      {n.type === 'file' && (
                        <button
                          onClick={() => download(n)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                          title="下载"
                        >
                          <IconDownload width={15} height={15} />
                        </button>
                      )}
                      <button
                        onClick={() => setConfirm([n.id])}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="删除"
                      >
                        <IconTrash width={15} height={15} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {confirm && (
        <ConfirmDialog
          title="确认删除"
          danger
          confirmText="删除"
          message={
            <>
              将删除 <b>{confirm.length}</b> 个项目及其全部子内容，文件会从磁盘上真正移除，无法恢复。
            </>
          }
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            onDelete(confirm);
            setConfirm(null);
            setSelected([]);
            notify('已提交删除');
          }}
        />
      )}
    </div>
  );
}

/* ---------------- 操作日志 ---------------- */

function LogsTab({
  logs,
  onReload,
  notify,
}: {
  logs: LogEntry[];
  onReload: () => void;
  notify: (t: string, ok?: boolean) => void;
}) {
  const [kw, setKw] = useState('');
  const [result, setResult] = useState<'all' | 'ok' | 'fail'>('all');
  const [confirmClear, setConfirmClear] = useState(false);

  const list = useMemo(() => {
    const k = kw.trim().toLowerCase();
    return logs.filter((l) => {
      if (result !== 'all' && l.result !== result) return false;
      if (!k) return true;
      return (
        l.target.toLowerCase().includes(k) ||
        l.actionLabel.toLowerCase().includes(k) ||
        l.detail.toLowerCase().includes(k) ||
        l.user.toLowerCase().includes(k)
      );
    });
  }, [logs, kw, result]);

  const clear = async () => {
    const res = await api('/api/admin/logs', { method: 'DELETE' });
    if (!res.ok) return notify('清空失败', false);
    notify('日志已清空');
    onReload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <IconSearch width={15} height={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="搜索操作、对象、用户…"
            className="w-64 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <select
          value={result}
          onChange={(e) => setResult(e.target.value as 'all' | 'ok' | 'fail')}
          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-brand-400"
        >
          <option value="all">全部结果</option>
          <option value="ok">仅成功</option>
          <option value="fail">仅失败</option>
        </select>
        <button className="btn-outline ml-auto" onClick={onReload}>
          <IconRefresh width={15} height={15} /> 刷新
        </button>
        <button className="btn-outline text-red-600 hover:bg-red-50" onClick={() => setConfirmClear(true)}>
          <IconTrash width={15} height={15} /> 清空日志
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs text-slate-500">
              <th className="w-40 py-2.5 pl-4 font-medium">时间</th>
              <th className="w-24 py-2.5 font-medium">操作</th>
              <th className="py-2.5 font-medium">对象</th>
              <th className="w-56 py-2.5 font-medium">详情</th>
              <th className="w-20 py-2.5 font-medium">结果</th>
              <th className="w-24 py-2.5 font-medium">用户</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-slate-400">
                  暂无日志
                </td>
              </tr>
            ) : (
              list.map((l) => (
                <tr key={l.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="py-2.5 pl-4 text-xs text-slate-500">{formatTime(l.ts)}</td>
                  <td className="py-2.5">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{l.actionLabel}</span>
                  </td>
                  <td className="max-w-[260px] truncate py-2.5 pr-3 text-slate-800" title={l.target}>
                    {l.target}
                  </td>
                  <td className="max-w-[240px] truncate py-2.5 pr-3 text-xs text-slate-500" title={l.detail}>
                    {l.detail || '—'}
                  </td>
                  <td className="py-2.5">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs ${
                        l.result === 'ok' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {l.result === 'ok' ? '成功' : '失败'}
                    </span>
                  </td>
                  <td className="py-2.5 text-xs text-slate-500">{l.user}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="清空操作日志"
          danger
          confirmText="清空"
          message="将删除全部历史操作记录，该操作不可恢复。"
          onClose={() => setConfirmClear(false)}
          onConfirm={() => {
            setConfirmClear(false);
            clear();
          }}
        />
      )}
    </div>
  );
}

/* ---------------- 登录会话 ---------------- */

function parseUA(ua: string): { device: string; browser: string } {
  const s = ua || '';
  let device = '未知设备';
  if (/iPhone/.test(s)) device = 'iPhone';
  else if (/iPad/.test(s)) device = 'iPad';
  else if (/Android/.test(s)) device = /Mobile/.test(s) ? 'Android 手机' : 'Android 设备';
  else if (/Macintosh|Mac OS/.test(s)) device = 'Mac';
  else if (/Windows/.test(s)) device = 'Windows';
  else if (/Linux/.test(s)) device = 'Linux';

  let browser = '未知浏览器';
  if (/Edg\//.test(s)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(s)) browser = 'Opera';
  else if (/Firefox\//.test(s)) browser = 'Firefox';
  else if (/Chrome\//.test(s)) browser = 'Chrome';
  else if (/Safari\//.test(s)) browser = 'Safari';
  else if (/curl\//.test(s)) browser = '脚本/curl';

  return { device, browser };
}

function SessionsTab({
  sessions,
  onReload,
  notify,
}: {
  sessions: SessionItem[];
  onReload: () => void;
  notify: (t: string, ok?: boolean) => void;
}) {
  const [kickId, setKickId] = useState<string | null>(null);
  const [kickOthers, setKickOthers] = useState(false);

  const kick = async (ids: string[]) => {
    const res = await api('/api/admin/sessions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return notify(d.error || '操作失败', false);
    notify(`已退出 ${d.removed ?? ids.length} 个会话`);
    onReload();
  };

  const kickAllOthers = async () => {
    const res = await api('/api/admin/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke-others' }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return notify(d.error || '操作失败', false);
    notify(`已退出其他 ${d.removed ?? 0} 个会话`);
    onReload();
  };

  const others = sessions.filter((s) => !s.current);
  const current = sessions.find((s) => s.current);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500">
          共 <b className="text-slate-800">{sessions.length}</b> 个活跃会话
          {others.length > 0 && <>，其中其他设备 <b className="text-slate-800">{others.length}</b> 个</>}
        </span>
        <button
          className="btn-outline ml-auto"
          onClick={onReload}
        >
          <IconRefresh width={15} height={15} /> 刷新
        </button>
        <button
          className="btn-outline text-red-600 hover:bg-red-50 disabled:opacity-40"
          disabled={others.length === 0}
          onClick={() => setKickOthers(true)}
        >
          <IconLogout width={15} height={15} /> 退出其他设备
        </button>
      </div>

      {/* 当前会话 */}
      {current && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-brand-700">
            <IconMonitor width={16} height={16} /> 当前登录（本设备）
          </div>
          <SessionRow s={current} onKick={() => undefined} />
        </div>
      )}

      {/* 其他会话 */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 text-xs font-medium text-slate-500">
          其他登录设备
        </div>
        {others.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">没有其它设备登录</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {others.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <SessionRow s={s} onKick={() => setKickId(s.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {kickId && (
        <ConfirmDialog
          title="退出该会话"
          danger
          confirmText="退出登录"
          message={
            <>
              将强制结束该设备的登录状态，对方需要重新登录。
            </>
          }
          onClose={() => setKickId(null)}
          onConfirm={() => {
            const id = kickId;
            setKickId(null);
            kick([id]);
          }}
        />
      )}

      {kickOthers && (
        <ConfirmDialog
          title="退出其他全部设备"
          danger
          confirmText="全部退出"
          message="将强制结束除本设备外的所有登录会话，其他设备需要重新登录。"
          onClose={() => setKickOthers(false)}
          onConfirm={() => {
            setKickOthers(false);
            kickAllOthers();
          }}
        />
      )}
    </div>
  );
}

/* ---------------- 分享管理 ---------------- */

interface AdminShare {
  id: string;
  url: string;
  nodeId: string;
  name: string;
  type: 'file' | 'folder';
  owner: string;
  expireAt: string | null;
  createdAt: string;
  expired: boolean;
}

function SharesTab({
  notify,
  onReload,
}: {
  notify: (t: string, ok?: boolean) => void;
  onReload: () => void;
}) {
  const [shares, setShares] = useState<AdminShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api('/api/share?all=1')
      .then((r) => r.json())
      .then((d) => setShares(d.shares ?? []))
      .catch(() => notify('加载分享列表失败', false))
      .finally(() => setLoading(false));
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (id: string) => {
    const res = await api(`/api/share/${id}`, { method: 'DELETE' });
    if (!res.ok) return notify('撤销失败', false);
    notify('已撤销该分享');
    load();
    onReload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500">
          共 <b className="text-slate-800">{shares.length}</b> 条分享链接
        </span>
        <button className="btn-outline ml-auto" onClick={load}>
          <IconRefresh width={15} height={15} /> 刷新
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs text-slate-500">
              <th className="py-2.5 pl-4 font-medium">文件</th>
              <th className="w-20 py-2.5 font-medium">类型</th>
              <th className="w-28 py-2.5 font-medium">所属账号</th>
              <th className="w-40 py-2.5 font-medium">过期时间</th>
              <th className="w-28 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm text-slate-400">
                  加载中…
                </td>
              </tr>
            ) : shares.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm text-slate-400">
                  暂无分享链接
                </td>
              </tr>
            ) : (
              shares.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="py-2.5 pl-4">
                    <span className="flex items-center gap-2">
                      <FileIcon kind={kindOf(s.name, s.type)} name={s.name} size={26} rounded="rounded-md" />
                      <span className="truncate text-slate-800" title={s.name}>
                        {s.name}
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 text-xs text-slate-500">{s.type === 'folder' ? '文件夹' : '文件'}</td>
                  <td className="py-2.5 text-xs font-medium text-slate-600">{s.owner}</td>
                  <td className="py-2.5 text-xs text-slate-500">
                    {s.expireAt ? formatTime(s.expireAt) : <span className="text-slate-400">永久</span>}
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="inline-flex gap-1">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                        title="打开分享页"
                      >
                        <IconEye width={15} height={15} />
                      </a>
                      <button
                        onClick={() => setRevokeId(s.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="撤销"
                      >
                        <IconTrash width={15} height={15} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {revokeId && (
        <ConfirmDialog
          title="撤销分享"
          danger
          confirmText="撤销"
          message="撤销后该链接将立即失效，访问者无法再查看或下载。"
          onClose={() => setRevokeId(null)}
          onConfirm={() => {
            const id = revokeId;
            setRevokeId(null);
            revoke(id);
          }}
        />
      )}
    </div>
  );
}

function SessionRow({ s, onKick }: { s: SessionItem; onKick: () => void }) {
  const { device, browser } = parseUA(s.ua);
  return (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <IconMonitor width={20} height={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm text-slate-800">
          <span className="font-medium">{device}</span>
          <span className="text-xs text-slate-400">· {browser}</span>
          {s.role === 'admin' && (
            <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[11px] text-white">管理员</span>
          )}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-400">
          {s.ip || '未知 IP'} · 登录 {formatTime(s.createdAt)} · 活跃 {formatTime(s.lastSeenAt)}
        </p>
      </div>
      {s.current ? (
        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-600">本设备</span>
      ) : (
        <button
          onClick={onKick}
          className="rounded-lg px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"
        >
          退出登录
        </button>
      )}
    </>
  );
}
