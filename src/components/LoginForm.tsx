'use client';

import { useState } from 'react';
import { IconCloud } from './Icons';

export default function LoginForm({ from }: { from?: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '登录失败');
        setLoading(false);
        return;
      }
      window.location.href = from && from.startsWith('/') ? from : '/';
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
            <IconCloud width={26} height={26} />
          </span>
          <h1 className="text-xl font-semibold text-slate-900">云盘</h1>
          <p className="mt-1 text-sm text-slate-500">登录后管理你的文件</p>
        </div>

        <form onSubmit={submit} className="card p-6">
          <label className="mb-1.5 block text-sm text-slate-600">账号</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            placeholder="请输入账号"
            className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />

          <label className="mb-1.5 block text-sm text-slate-600">密码</label>
          <div className="relative">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="请输入密码"
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

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button type="submit" disabled={loading} className="btn-primary mt-5 w-full justify-center py-2.5">
            {loading ? '登录中…' : '登 录'}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-slate-500">
          还没有账号？
          <a href="/register" className="ml-1 font-medium text-brand-600 hover:underline">
            注册新账号
          </a>
        </div>
        <p className="mt-3 text-center text-xs text-slate-400">本机部署的个人网盘 · 会话有效期 7 天</p>
      </div>
    </div>
  );
}
