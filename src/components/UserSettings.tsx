'use client';

import { useRef, useState } from 'react';
import { ConfirmDialog } from './Dialogs';
import { IconCamera, IconKey, IconTrash, IconUser } from './Icons';

interface Props {
  user: string;
  role: 'admin' | 'user';
  avatar: string;
  onAvatarChange: (dataUrl: string) => void;
  notify: (t: string, ok?: boolean) => void;
  onBack: () => void;
}

/** 根据用户名生成稳定的头像底色 */
function avatarColor(name: string): string {
  const palette = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0d9488', '#0891b2', '#65a30d', '#9333ea'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export default function UserSettings({ user, role, avatar, onAvatarChange, notify, onBack }: Props) {
  const [localAvatar, setLocalAvatar] = useState(avatar);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return notify('请选择图片文件', false);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return notify('浏览器不支持图片处理', false);
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setLocalAvatar(dataUrl);
        void saveAvatar(dataUrl);
      };
      img.onerror = () => notify('图片读取失败', false);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const saveAvatar = async (dataUrl: string) => {
    const res = await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', avatar: dataUrl }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return notify(d.error || '头像更新失败', false);
    onAvatarChange(dataUrl);
    notify('头像已更新');
  };

  const removeAvatar = async () => {
    setLocalAvatar('');
    const res = await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', avatar: null }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLocalAvatar(avatar);
      return notify(d.error || '头像移除失败', false);
    }
    onAvatarChange('');
    notify('已移除头像');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={onBack} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="返回网盘">
          <IconUser width={18} height={18} />
        </button>
        <h1 className="text-lg font-semibold text-slate-900">用户设置</h1>
      </div>

      <div className="space-y-5">
        <AvatarCard
          user={user}
          avatar={localAvatar}
          onPick={() => fileRef.current?.click()}
          onRemove={removeAvatar}
        />
        <PasswordCard notify={notify} />
        <DangerCard user={user} notify={notify} />
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
    </div>
  );
}

/* ---------------- 头像 ---------------- */

function AvatarCard({
  user,
  avatar,
  onPick,
  onRemove,
}: {
  user: string;
  avatar: string;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="card p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-800">头像</h2>
      <div className="flex items-center gap-5">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="头像" className="h-20 w-20 rounded-full object-cover ring-2 ring-slate-100" />
        ) : (
          <span
            className="grid h-20 w-20 place-items-center rounded-full text-2xl font-semibold text-white"
            style={{ background: avatarColor(user) }}
          >
            {user.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="flex flex-col gap-2">
          <button className="btn-primary" onClick={onPick}>
            <IconCamera width={16} height={16} /> 上传新头像
          </button>
          {avatar && (
            <button className="btn-outline" onClick={onRemove}>
              移除头像
            </button>
          )}
          <p className="text-xs text-slate-400">支持 JPG / PNG，自动裁剪为正方形，上限 256KB</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 更改密码 ---------------- */

function PasswordCard({ notify }: { notify: (t: string, ok?: boolean) => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!current) return notify('请输入当前密码', false);
    if (next && next !== next2) return notify('两次输入的新密码不一致', false);
    if (next && next.length < 6) return notify('新密码至少需要 6 位', false);
    setBusy(true);
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', currentPassword: current, password: next || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return notify(d.error || '修改失败', false);
      notify('已保存，即将退出并重新登录');
      window.setTimeout(async () => {
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
        window.location.href = '/login';
      }, 1300);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5">
      <h2 className="mb-1 text-sm font-semibold text-slate-800">更改密码</h2>
      <p className="mb-4 text-xs text-slate-400">修改密码后需要重新登录</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm text-slate-600">当前密码</label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="验证身份用"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-slate-600">新密码</label>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="留空则不修改"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-slate-600">确认新密码</label>
          <input
            type="password"
            value={next2}
            onChange={(e) => setNext2(e.target.value)}
            placeholder="再次输入新密码"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>
      <button className="btn-primary mt-4" onClick={save} disabled={busy}>
        <IconKey width={16} height={16} /> {busy ? '保存中…' : '保存修改'}
      </button>
    </div>
  );
}

/* ---------------- 注销账号 ---------------- */

function DangerCard({ user, notify }: { user: string; notify: (t: string, ok?: boolean) => void }) {
  const [confirm, setConfirm] = useState(false);
  const [pwd, setPwd] = useState('');

  const doDelete = async () => {
    if (!pwd) return notify('请输入当前密码', false);
    const res = await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', currentPassword: pwd }),
    });
    const d = await res.json().catch(() => ({}));
    setConfirm(false);
    setPwd('');
    if (!res.ok) return notify(d.error || '注销失败', false);
    notify('账号已注销，正在退出…');
    window.setTimeout(async () => {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
      window.location.href = '/login';
    }, 1200);
  };

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/50 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-red-700">
        <IconTrash width={16} height={16} /> 注销账号
      </h2>
      <p className="mt-1.5 text-xs text-slate-500">
        注销后将删除账号 <b className="text-slate-700">{user}</b> 并清除其登录会话，此操作不可恢复。网盘中的文件仍保留（由其他账号继续管理）。
      </p>
      <button className="btn mt-4 bg-red-600 text-white hover:bg-red-700" onClick={() => setConfirm(true)}>
        <IconTrash width={15} height={15} /> 注销我的账号
      </button>

      {confirm && (
        <ConfirmDialog
          title="注销账号"
          danger
          confirmText="确认注销"
          message={
            <div className="space-y-3">
              <p>
                此操作会永久删除账号 <b>{user}</b> 并退出登录，无法恢复。请输入当前密码确认：
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
          onConfirm={doDelete}
        />
      )}
    </div>
  );
}
