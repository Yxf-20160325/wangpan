'use client';

import { useState } from 'react';
import { IconAlert, IconCloud, IconUser } from './Icons';

export default function RegisterForm({ allowRegister = true }: { allowRegister?: boolean }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [loading, setLoading] = useState(false);

  // 管理员已关闭注册时，隐藏表单并提示用户
  if (!allowRegister) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-brand-50 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-7 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-pop">
              <IconUser width={24} height={24} />
            </span>
            <h1 className="text-xl font-semibold text-slate-900">注册账号</h1>
            <p className="mt-1 text-sm text-slate-500">创建后即可使用云盘</p>
          </div>

          <div className="card p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500">
              <IconAlert width={24} height={24} />
            </div>
            <p className="text-base font-semibold text-slate-800">注册暂停使用</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              当前管理员已关闭注册功能，暂无法自行创建账号。如需使用，请联系管理员开通。
            </p>
          </div>

          <div className="mt-5 text-center text-sm text-slate-500">
            已有账号？
            <a href="/login" className="ml-1 font-medium text-brand-600 hover:underline">
              去登录
            </a>
          </div>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <IconCloud width={13} height={13} /> 云盘 · 本机部署
          </p>
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setDone('');

    if (username.trim().length < 2) return setError('账号至少需要 2 个字符');
    if (password.length < 6) return setError('密码至少需要 6 位');
    if (password !== confirm) return setError('两次输入的密码不一致');

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '注册失败');
        setLoading(false);
        return;
      }
      setDone('注册成功，正在前往登录页…');
      window.setTimeout(() => {
        window.location.href = '/login';
      }, 900);
    } catch {
      setError('网络异常，请重试');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-brand-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-pop">
            <IconUser width={24} height={24} />
          </span>
          <h1 className="text-xl font-semibold text-slate-900">注册账号</h1>
          <p className="mt-1 text-sm text-slate-500">创建后即可使用云盘</p>
        </div>

        <form onSubmit={submit} className="card p-6">
          <label className="mb-1.5 block text-sm text-slate-600">账号</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            placeholder="2-24 个字符，支持中英文数字"
            className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />

          <label className="mb-1.5 block text-sm text-slate-600">密码</label>
          <div className="relative mb-4">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={show ? 'text' : 'password'}
              placeholder="至少 6 位"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-14 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            >
              {show ? '隐藏' : '显示'}
            </button>
          </div>

          <label className="mb-1.5 block text-sm text-slate-600">确认密码</label>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            type={show ? 'text' : 'password'}
            placeholder="再次输入密码"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />

          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          {done && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">{done}</p>}

          <button type="submit" disabled={loading || !!done} className="btn-primary mt-5 w-full justify-center py-2.5">
            {loading ? '注册中…' : done ? '注册成功' : '注 册'}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-slate-500">
          已有账号？
          <a href="/login" className="ml-1 font-medium text-brand-600 hover:underline">
            去登录
          </a>
        </div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <IconCloud width={13} height={13} /> 云盘 · 本机部署
        </p>
      </div>
    </div>
  );
}
