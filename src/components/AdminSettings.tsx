'use client';

import { Fragment, useState } from 'react';
import { ConfirmDialog } from './Dialogs';
import { IconAlert, IconTrash, IconUser } from './Icons';
import { formatTime } from '@/lib/format';
import { api } from '@/lib/clientApi';

interface UserItem {
  id: string;
  username: string;
  role: 'admin' | 'user';
  createdAt: string;
}

interface Props {
  user: string;
  users: UserItem[];
  allowRegister: boolean;
  onReload: () => void;
  notify: (t: string, ok?: boolean) => void;
}

export default function SettingsTab({ user, users, allowRegister, onReload, notify }: Props) {
  return (
    <div className="max-w-3xl space-y-5">
      <UsersCard users={users} current={user} allowRegister={allowRegister} onReload={onReload} notify={notify} />
      <MyAccountCard user={user} notify={notify} />
      <DangerZone user={user} notify={notify} onReload={onReload} />
    </div>
  );
}

/* ---------------- 用户管理 ---------------- */

function UsersCard({
  users,
  current,
  allowRegister,
  onReload,
  notify,
}: {
  users: UserItem[];
  current: string;
  allowRegister: boolean;
  onReload: () => void;
  notify: (t: string, ok?: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [pwd, setPwd] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [busy, setBusy] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [delTarget, setDelTarget] = useState<UserItem | null>(null);

  const create = async () => {
    if (name.trim().length < 2) return notify('账号至少需要 2 个字符', false);
    if (pwd.length < 6) return notify('密码至少需要 6 位', false);
    setBusy(true);
    try {
      const res = await api('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', username: name, password: pwd, role }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return notify(d.error || '创建失败', false);
      notify('账号已创建');
      setName('');
      setPwd('');
      setRole('user');
      setOpen(false);
      onReload();
    } finally {
      setBusy(false);
    }
  };

  const setUserRole = async (u: UserItem, next: 'admin' | 'user') => {
    const res = await api('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id: u.id, role: next }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return notify(d.error || '修改失败', false);
    notify('角色已更新');
    onReload();
  };

  const doReset = async (u: UserItem) => {
    if (resetPwd.length < 6) return notify('新密码至少需要 6 位', false);
    const res = await api('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id: u.id, password: resetPwd }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return notify(d.error || '重置失败', false);
    notify(`已重置 ${u.username} 的密码`);
    setResetId(null);
    setResetPwd('');
    onReload();
  };

  const doDelete = async (u: UserItem) => {
    const res = await api('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: u.id }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return notify(d.error || '删除失败', false);
    notify('账号已删除');
    onReload();
  };

  const toggleRegister = async () => {
    const res = await api('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'settings', allowRegister: !allowRegister }),
    });
    if (!res.ok) return notify('设置失败', false);
    notify(allowRegister ? '已关闭注册' : '已开放注册');
    onReload();
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">用户管理</h2>
          <p className="mt-0.5 text-xs text-slate-400">共 {users.length} 个账号</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-outline" onClick={toggleRegister}>
            {allowRegister ? '关闭注册' : '开放注册'}
          </button>
          <button className="btn-primary" onClick={() => setOpen((v) => !v)}>
            <IconUser width={15} height={15} /> 新建账号
          </button>
        </div>
      </div>

      {open && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="新账号"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <input
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              type="password"
              placeholder="初始密码（≥6 位）"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
              className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm outline-none focus:border-brand-500"
            >
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
            <button className="btn-primary" onClick={create} disabled={busy}>
              {busy ? '创建中…' : '创建'}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs text-slate-500">
              <th className="py-2.5 pl-3 font-medium">账号</th>
              <th className="w-28 py-2.5 font-medium">角色</th>
              <th className="w-36 py-2.5 font-medium">创建时间</th>
              <th className="w-40 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <Fragment key={u.id}>
                <tr className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 pl-3">
                    <span className="flex items-center gap-2">
                      <span className="text-slate-800">{u.username}</span>
                      {u.username === current && (
                        <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] text-brand-700">当前</span>
                      )}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <select
                      value={u.role}
                      onChange={(e) => setUserRole(u, e.target.value as 'admin' | 'user')}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand-400"
                    >
                      <option value="admin">管理员</option>
                      <option value="user">普通用户</option>
                    </select>
                  </td>
                  <td className="py-2.5 text-xs text-slate-400">{formatTime(u.createdAt)}</td>
                  <td className="py-2.5 pr-3 text-right">
                    <button
                      onClick={() => {
                        setResetId(resetId === u.id ? null : u.id);
                        setResetPwd('');
                      }}
                      className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                    >
                      重置密码
                    </button>
                    <button
                      onClick={() => setDelTarget(u)}
                      disabled={u.username === current}
                      className={`rounded-lg px-2 py-1 text-xs ${
                        u.username === current
                          ? 'cursor-not-allowed text-slate-300'
                          : 'text-red-600 hover:bg-red-50'
                      }`}
                    >
                      删除
                    </button>
                  </td>
                </tr>
                {resetId === u.id && (
                  <tr className="border-b border-slate-50 bg-slate-50/60">
                    <td colSpan={4} className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">为 {u.username} 设置新密码</span>
                        <input
                          value={resetPwd}
                          onChange={(e) => setResetPwd(e.target.value)}
                          type="password"
                          placeholder="新密码（≥6 位）"
                          className="w-48 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
                        />
                        <button className="btn-primary px-2.5 py-1.5 text-xs" onClick={() => doReset(u)}>
                          保存
                        </button>
                        <button className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => setResetId(null)}>
                          取消
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        注册状态：{allowRegister ? '开放（任何人可注册）' : '关闭（仅管理员可建账号）'}
      </p>

      {delTarget && (
        <ConfirmDialog
          title="删除账号"
          danger
          confirmText="删除"
          message={
            <>
              确定删除账号 <b>{delTarget.username}</b> 吗？该账号将无法登录，此操作不可恢复。
            </>
          }
          onClose={() => setDelTarget(null)}
          onConfirm={() => {
            doDelete(delTarget);
            setDelTarget(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- 我的账号 ---------------- */

function MyAccountCard({ user, notify }: { user: string; notify: (t: string, ok?: boolean) => void }) {
  const [username, setUsername] = useState(user);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!current) return notify('请输入当前密码', false);
    if (next && next !== next2) return notify('两次输入的新密码不一致', false);
    if (username.trim().length < 2) return notify('账号至少需要 2 个字符', false);
    setSaving(true);
    try {
      const res = await api('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'account',
          currentPassword: current,
          username: username.trim(),
          password: next || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(d.error || '保存失败', false);
        return;
      }
      notify('已保存，即将退出并重新登录');
      window.setTimeout(async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
      }, 1300);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5">
      <h2 className="mb-1 text-sm font-semibold text-slate-800">我的账号</h2>
      <p className="mb-4 text-xs text-slate-400">修改账号或密码后需要重新登录</p>

      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm text-slate-600">账号</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-slate-600">当前密码</label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="验证身份用"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-slate-600">新密码（留空则不改）</label>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-slate-600">确认新密码</label>
            <input
              type="password"
              value={next2}
              onChange={(e) => setNext2(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
      </div>

      <button className="btn-primary mt-4" onClick={save} disabled={saving}>
        {saving ? '保存中…' : '保存修改'}
      </button>
    </div>
  );
}

/* ---------------- 危险操作 ---------------- */

function DangerZone({
  user,
  notify,
  onReload,
}: {
  user: string;
  notify: (t: string, ok?: boolean) => void;
  onReload: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [pwd, setPwd] = useState('');

  const wipe = async () => {
    if (!pwd) return notify('请输入当前密码', false);
    const check = await api('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'account', currentPassword: pwd, username: user }),
    });
    if (!check.ok) {
      setConfirm(false);
      setPwd('');
      return notify('密码不正确，已取消', false);
    }

    const res = await api('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear-data' }),
    });
    const d = await res.json().catch(() => ({}));
    setConfirm(false);
    setPwd('');
    if (!res.ok) return notify(d.error || '清空失败', false);
    notify(`已清空 ${d.removed ?? 0} 个节点`);
    onReload();
  };

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/50 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-red-700">
        <IconAlert width={16} height={16} /> 危险操作
      </h2>
      <p className="mt-1.5 text-xs text-slate-500">
        清空全部数据会删除网盘中的所有文件与文件夹，并从磁盘上移除真实文件，无法恢复。
      </p>
      <button className="btn mt-4 bg-red-600 text-white hover:bg-red-700" onClick={() => setConfirm(true)}>
        <IconTrash width={15} height={15} /> 清空全部数据
      </button>

      {confirm && (
        <ConfirmDialog
          title="清空全部数据"
          danger
          confirmText="确认清空"
          message={
            <div className="space-y-3">
              <p>
                此操作会删除网盘内<b>所有</b>文件与文件夹，无法恢复。请输入当前密码以确认：
              </p>
              <input
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="当前密码"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-400"
              />
            </div>
          }
          onClose={() => {
            setConfirm(false);
            setPwd('');
          }}
          onConfirm={wipe}
        />
      )}
    </div>
  );
}
