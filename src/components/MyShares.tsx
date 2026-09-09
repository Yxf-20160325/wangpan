'use client';

import { useEffect, useState } from 'react';
import { IconArchive, IconArrowLeft, IconCopy, IconDoc, IconEye, IconFolder, IconImage, IconLink, IconShare, IconTrash, IconVideo } from './Icons';
import FileIcon from './FileIcon';
import { formatSize, formatTime } from '@/lib/format';
import type { Kind } from '@/lib/fileKind';

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

function kindFor(type: 'file' | 'folder', name: string): Kind {
  if (type === 'folder') return 'folder';
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) return 'image';
  if (/\.(mp4|webm|mov|mkv|avi)$/i.test(name)) return 'video';
  if (/\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(name)) return 'audio';
  if (/\.(pdf|docx?|xlsx?|pptx?|txt|md|markdown|js|ts|jsx|tsx|json|py|css|html?)$/i.test(name)) return 'doc';
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return 'archive';
  return 'file' as Kind;
}

export default function MyShares({
  notify,
  onBack,
}: {
  notify: (text: string, ok?: boolean) => void;
  onBack: () => void;
}) {
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch('/api/share')
      .then((r) => r.json())
      .then((d) => setShares(d.shares ?? []))
      .catch(() => notify('加载分享列表失败', false))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

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
    <div className="flex min-h-screen flex-col bg-[#f6f7f9]">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          <IconArrowLeft width={16} height={16} /> 返回
        </button>
        <div className="flex items-center gap-2">
          <IconShare width={18} height={18} className="text-brand-600" />
          <h1 className="text-[15px] font-semibold text-slate-900">我的分享</h1>
        </div>
        <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
          共 {shares.length} 条
        </span>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {loading ? (
          <p className="py-16 text-center text-sm text-slate-400">加载中…</p>
        ) : shares.length === 0 ? (
          <div className="grid place-items-center py-20 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <IconShare width={30} height={30} />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-700">还没有分享链接</p>
            <p className="mt-1 text-xs text-slate-400">在文件上点击「分享」即可生成公开链接</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {shares.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 hover:shadow-card"
              >
                <FileIcon kind={kindFor(s.type, s.name)} name={s.name} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800" title={s.name}>
                    {s.name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400" title={s.url}>
                    {s.url}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {s.type === 'folder' ? '文件夹' : formatSize(s.size)} ·{' '}
                    {s.expireAt ? `将于 ${formatTime(s.expireAt)} 过期` : '永久有效'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => copy(s.url)}
                    title="复制链接"
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                  >
                    <IconCopy width={16} height={16} />
                  </button>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    title="打开分享页"
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                  >
                    <IconEye width={16} height={16} />
                  </a>
                  <button
                    onClick={() => revoke(s.id)}
                    title="撤销"
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <IconTrash width={16} height={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
