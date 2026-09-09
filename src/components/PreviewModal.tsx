'use client';

import { useEffect, useState } from 'react';
import { IconDownload, IconX } from './Icons';
import { kindOf, canPreview } from '@/lib/fileKind';
import { extOf, formatSize, formatTime } from '@/lib/format';
import { renderMarkdown } from '@/lib/markdown';
import type { FSNodeView } from '@/lib/types';

const RAW = (id: string) => `/api/raw/${id}`;

export default function PreviewModal({ node, onClose }: { node: FSNodeView; onClose: () => void }) {
  const kind = kindOf(node.name, node.type);
  const isMarkdown = kind === 'text' && /\.(md|markdown)$/i.test(node.name);
  const [text, setText] = useState<string | null>(null);
  const [textError, setTextError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    if (kind !== 'text' && kind !== 'code') return;
    let alive = true;
    setText(null);
    setTextError('');
    fetch(RAW(node.id))
      .then((r) => r.text())
      .then((t) => {
        if (!alive) return;
        setText(t.length > 400_000 ? t.slice(0, 400_000) + '\n\n…… 内容过大，仅显示前 400 KB' : t);
      })
      .catch(() => alive && setTextError('读取失败'));
    return () => {
      alive = false;
    };
  }, [node.id, kind]);

  if (node.type === 'folder') return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 anim-fade" onClick={onClose}>
      <div className="flex items-center justify-between gap-4 px-5 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium">{node.name}</p>
          <p className="mt-0.5 text-xs text-white/60">
            {formatSize(node.size)} · {formatTime(node.updatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${RAW(node.id)}?d=1`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
          >
            <IconDownload width={16} height={16} /> 下载
          </a>
          <button onClick={onClose} className="rounded-lg bg-white/10 p-2 hover:bg-white/20" aria-label="关闭">
            <IconX width={18} height={18} />
          </button>
        </div>
      </div>

      <div
        className="flex min-h-0 flex-1 items-center justify-center px-4 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        {kind === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={RAW(node.id)}
            alt={node.name}
            className="max-h-full max-w-full rounded-lg bg-white object-contain shadow-pop"
          />
        )}

        {kind === 'video' && (
          <video src={RAW(node.id)} controls autoPlay className="max-h-full max-w-full rounded-lg bg-black shadow-pop" />
        )}

        {kind === 'audio' && (
          <div className="w-[420px] rounded-2xl bg-white p-6 shadow-pop">
            <p className="mb-4 text-center text-sm text-slate-500">{node.name}</p>
            <audio src={RAW(node.id)} controls className="w-full" />
          </div>
        )}

        {kind === 'pdf' && (
          <iframe src={RAW(node.id)} className="h-full w-full max-w-5xl rounded-lg bg-white shadow-pop" title={node.name} />
        )}

        {(kind === 'text' || kind === 'code') && (
          <div className="h-full w-full max-w-5xl overflow-auto rounded-lg bg-white p-5 shadow-pop">
            {textError ? (
              <p className="text-sm text-red-600">{textError}</p>
            ) : text === null ? (
              <p className="text-sm text-slate-400">加载中…</p>
            ) : isMarkdown ? (
              <div className="text-[14px]">{renderMarkdown(text)}</div>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-slate-800">{text}</pre>
            )}
          </div>
        )}

        {!canPreview(kind) && (
          <div className="rounded-2xl bg-white px-10 py-12 text-center shadow-pop">
            <p className="text-[15px] font-medium text-slate-800">该文件类型暂不支持在线预览</p>
            <p className="mt-1.5 text-sm text-slate-500">你可以下载到本地后打开</p>
            <a
              href={`${RAW(node.id)}?d=1`}
              className="btn-primary mt-5"
              onClick={(e) => e.stopPropagation()}
            >
              <IconDownload width={16} height={16} /> 下载文件
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
