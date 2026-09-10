'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { IconChevronRight, IconFolder, IconHome, IconX } from './Icons';

function Shell({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 anim-fade" onClick={onClose}>
      <div
        className={`flex max-h-[90vh] w-full flex-col rounded-2xl bg-white shadow-pop anim-pop ${wide ? 'max-w-2xl' : 'max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <IconX width={16} height={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
}) {
  return (
    <Shell title={title} onClose={onClose} footer={footer} wide={size === 'lg'}>
      {children}
    </Shell>
  );
}

export function NameDialog({
  title,
  label,
  defaultValue = '',
  confirmText = '确定',
  onSubmit,
  onClose,
}: {
  title: string;
  label: string;
  defaultValue?: string;
  confirmText?: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const dot = defaultValue.lastIndexOf('.');
    if (dot > 0) el.setSelectionRange(0, dot);
    else el.select();
  }, [defaultValue]);

  const submit = () => {
    const v = value.trim();
    if (v) onSubmit(v);
  };

  return (
    <Shell title={title} onClose={onClose}>
      <label className="mb-1.5 block text-sm text-slate-600">{label}</label>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        placeholder="请输入名称"
      />
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose}>
          取消
        </button>
        <button className="btn-primary" onClick={submit} disabled={!value.trim()}>
          {confirmText}
        </button>
      </div>
    </Shell>
  );
}

interface FolderLite {
  id: string;
  name: string;
  parentId: string | null;
}

export function MoveDialog({
  count,
  onConfirm,
  onClose,
}: {
  count: number;
  onConfirm: (targetId: string | null) => void;
  onClose: () => void;
}) {
  const [folders, setFolders] = useState<FolderLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tree')
      .then((r) => r.json())
      .then((d) => setFolders(d.folders ?? []))
      .finally(() => setLoading(false));
  }, []);

  const path = useMemo(() => {
    const chain: FolderLite[] = [];
    let cur = folders.find((f) => f.id === cursor) ?? null;
    let guard = 0;
    while (cur && guard++ < 200) {
      chain.unshift(cur);
      cur = cur.parentId ? folders.find((f) => f.id === cur!.parentId) ?? null : null;
    }
    return chain;
  }, [folders, cursor]);

  const children = folders.filter((f) => f.parentId === cursor);

  return (
    <Shell title={`移动 ${count} 个项目到`} onClose={onClose}>
      <div className="mb-3 flex flex-wrap items-center gap-1 text-sm text-slate-500">
        <button
          onClick={() => setCursor(null)}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${cursor === null ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-100'}`}
        >
          <IconHome width={14} height={14} /> 全部文件
        </button>
        {path.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1">
            <IconChevronRight width={14} height={14} />
            <button
              onClick={() => setCursor(p.id)}
              className={`rounded-md px-2 py-1 ${cursor === p.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-100'}`}
            >
              {p.name}
            </button>
          </span>
        ))}
      </div>

      <div className="max-h-64 min-h-[120px] overflow-auto rounded-lg border border-slate-200">
        {loading ? (
          <p className="p-4 text-sm text-slate-400">加载中…</p>
        ) : children.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">该目录下没有子文件夹</p>
        ) : (
          children.map((f) => (
            <button
              key={f.id}
              onClick={() => setCursor(f.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
            >
              <IconFolder width={17} height={17} className="text-amber-500" />
              <span className="flex-1 truncate text-slate-700">{f.name}</span>
              <IconChevronRight width={15} height={15} className="text-slate-300" />
            </button>
          ))
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose}>
          取消
        </button>
        <button className="btn-primary" onClick={() => onConfirm(cursor)}>
          移动到此处
        </button>
      </div>
    </Shell>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmText = '确定',
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Shell title={title} onClose={onClose}>
      <div className="text-sm leading-relaxed text-slate-600">{message}</div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose}>
          取消
        </button>
        <button
          className={`btn ${danger ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
          onClick={onConfirm}
        >
          {confirmText}
        </button>
      </div>
    </Shell>
  );
}
