'use client';

import { useEffect, useState } from 'react';
import { IconCopy, IconLink, IconShare, IconX } from './Icons';
import { formatSize, formatTime } from '@/lib/format';
import type { FSNodeView } from '@/lib/types';

interface ShareItem {
  id: string;
  url: string;
  nodeId: string;
  name: string;
  type: 'file' | 'folder';
  size: number;
  expireAt: string | null;
  createdAt: string;
  expired: boolean;
}

const TTL_OPTIONS = [
  { value: 0, label: '永久有效' },
  { value: 1, label: '1 天' },
  { value: 7, label: '7 天' },
  { value: 30, label: '30 天' },
];

export default function ShareDialog({
  node,
  onClose,
  notify,
}: {
  node: FSNodeView;
  onClose: () => void;
  notify: (text: string, ok?: boolean) => void;
}) {
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [ttl, setTtl] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const load = () => {
    setLoading(true);
    fetch(`/api/share?nodeId=${encodeURIComponent(node.id)}`)
      .then((r) => r.json())
      .then((d) => setShares(d.shares ?? []))
      .catch(() => notify('加载分享列表失败', false))
      .finally(() => setLoading(false));
  };

  useEffect(load, [node.id]);

  const create = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: node.id, ttl }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '创建失败');
      notify('分享链接已生成');
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : '创建失败', false);
    } finally {
      setCreating(false);
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      notify('链接已复制');
    } catch {
      notify('复制失败，请手动复制', false);
    }
  };

  const revoke = async (id: string) => {
    const res = await fetch(`/api/share/${id}`, { method: 'DELETE' });
    if (!res.ok) return notify('撤销失败', false);
    notify('已撤销该分享');
    setShares((s) => s.filter((x) => x.id !== id));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 anim-fade" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-pop anim-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <IconShare width={17} height={17} className="text-brand-600" /> 分享「{node.name}」
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <IconX width={16} height={16} />
          </button>
        </div>

        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
          分享后，任何人拿到链接都能在浏览器中查看并下载（不会自动下载，类似 123 云盘的分享页）。
        </div>

        <div className="mt-4 flex items-end gap-2">
          <label className="flex-1">
            <span className="mb-1.5 block text-sm text-slate-600">有效期</span>
            <select
              value={ttl}
              onChange={(e) => setTtl(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {TTL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-primary" onClick={create} disabled={creating}>
            {creating ? '生成中…' : '生成分享链接'}
          </button>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-slate-700">已有分享链接</p>
          {loading ? (
            <p className="py-4 text-sm text-slate-400">加载中…</p>
          ) : shares.length === 0 ? (
            <p className="py-4 text-sm text-slate-400">还没有分享链接</p>
          ) : (
            <ul className="space-y-2">
              {shares.map((s) => (
                <li key={s.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <IconLink width={15} height={15} className="shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700">{s.url}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{s.expireAt ? `过期：${formatTime(s.expireAt)}` : '永久有效'}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copy(s.url)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-slate-100 hover:text-brand-600"
                      >
                        <IconCopy width={13} height={13} /> 复制
                      </button>
                      <button
                        onClick={() => revoke(s.id)}
                        className="rounded-lg px-2 py-1 text-red-600 hover:bg-red-50"
                      >
                        撤销
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
