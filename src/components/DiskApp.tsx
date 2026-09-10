'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FileIcon from './FileIcon';
import PreviewModal from './PreviewModal';
import UserSettings from './UserSettings';
import ShareDialog from './ShareDialog';
import MyShares from './MyShares';
import { ConfirmDialog, MoveDialog, NameDialog } from './Dialogs';
import {
  IconArchive,
  IconAudio,
  IconChevronLeft,
  IconChevronRight,
  IconCloud,
  IconDoc,
  IconDots,
  IconDownload,
  IconEye,
  IconFolderPlus,
  IconGrid,
  IconHome,
  IconImage,
  IconList,
  IconLogout,
  IconMove,
  IconRefresh,
  IconRename,
  IconSearch,
  IconShield,
  IconShare,
  IconSliders,
  IconSort,
  IconTrash,
  IconUpload,
  IconUser,
  IconVideo,
  IconX,
} from './Icons';
import { canPreview, kindOf, type Kind } from '@/lib/fileKind';
import { formatSize, formatTime } from '@/lib/format';
import type { FSNodeView, SortDir, SortKey } from '@/lib/types';

type DialogState =
  | { type: 'newFolder' }
  | { type: 'rename'; node: FSNodeView }
  | { type: 'move'; ids: string[] }
  | { type: 'delete'; ids: string[] }
  | null;

type Filter = Kind | 'all';

const CATEGORIES: { key: Filter; label: string; icon: typeof IconImage; kinds: Kind[] }[] = [
  { key: 'all', label: '全部文件', icon: IconHome, kinds: [] },
  { key: 'image', label: '图片', icon: IconImage, kinds: ['image'] },
  { key: 'video', label: '视频', icon: IconVideo, kinds: ['video'] },
  { key: 'audio', label: '音频', icon: IconAudio, kinds: ['audio'] },
  { key: 'doc', label: '文档', icon: IconDoc, kinds: ['doc', 'sheet', 'slide', 'pdf', 'text', 'code'] },
  { key: 'archive', label: '压缩包', icon: IconArchive, kinds: ['archive'] },
];

const SORT_LABEL: Record<SortKey, string> = {
  name: '名称',
  size: '大小',
  updatedAt: '修改时间',
  type: '类型',
};

export default function DiskApp({
  user,
  role,
  avatar,
}: {
  user: string;
  role: 'admin' | 'user';
  avatar?: string;
}) {
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<FSNodeView[]>([]);
  const [path, setPath] = useState<{ id: string; name: string }[]>([]);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState<'disk' | 'settings' | 'shares'>('disk');
  const [myAvatar, setMyAvatar] = useState(avatar ?? '');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [preview, setPreview] = useState<FSNodeView | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [shareNode, setShareNode] = useState<FSNodeView | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string | null } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // 管理员“查看他人文件”模式：null=查看自己的文件；否则为被查看的账号名（只读）
  const [viewOwner, setViewOwner] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [stats, setStats] = useState({ fileCount: 0, folderCount: 0, totalSize: 0, used: 0, quota: 500 * 1024 * 1024, remaining: 500 * 1024 * 1024 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastIndexRef = useRef<number | null>(null);

  const notify = useCallback((text: string, ok = true) => {
    setToast({ text, ok });
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  /* ---------- 加载列表 ---------- */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    else if (filter !== 'all') params.set('all', '1');
    else if (currentId) params.set('parentId', currentId);
    if (viewOwner) params.set('owner', viewOwner);
    params.set('sort', sortKey);
    params.set('dir', sortDir);

    fetch(`/api/nodes?${params.toString()}`)
      .then((r) => {
        if (r.status === 401) {
          // 会话失效/被踢：先清除 cookie 再跳转登录页，避免 token 仍有效时 middleware 把 /login 弹回 / 造成循环
          void logout();
          throw new Error('UNAUTHORIZED');
        }
        return r.json();
      })
      .then((d) => {
        if (!alive) return;
        setNodes(d.nodes ?? []);
        setPath(d.path ?? []);
        setSelected([]);
        lastIndexRef.current = null;
      })
      .catch(() => alive && notify('加载失败', false))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [currentId, query, filter, sortKey, sortDir, reloadKey, viewOwner, notify]);

  /* ---------- 管理员：查看他人文件 ---------- */
  const openAccountPicker = async () => {
    if (!accounts.length) {
      try {
        const r = await fetch('/api/admin/accounts');
        const d = await r.json();
        if (r.ok) setAccounts(d.accounts ?? []);
      } catch {
        /* ignore */
      }
    }
    setPickerOpen((o) => !o);
  };

  const selectOwner = (name: string) => {
    setViewOwner(name);
    setCurrentId(null);
    setQuery('');
    setSearchInput('');
    setFilter('all');
    setPickerOpen(false);
  };

  const exitView = () => {
    setViewOwner(null);
    setCurrentId(null);
    setQuery('');
    setSearchInput('');
    setFilter('all');
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.href = '/login';
  };

  /* ---------- 加载统计 ---------- */
  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((d) =>
        setStats({
          fileCount: d.fileCount ?? 0,
          folderCount: d.folderCount ?? 0,
          totalSize: d.used ?? 0,
          used: d.used ?? 0,
          quota: d.quota ?? 500 * 1024 * 1024,
          remaining: d.remaining ?? d.quota ?? 500 * 1024 * 1024,
        }),
      )
      .catch(() => undefined);
  }, [reloadKey]);

  /* ---------- 前端过滤 ---------- */
  const visible = useMemo(() => {
    if (filter === 'all') return nodes;
    const cat = CATEGORIES.find((c) => c.key === filter);
    if (!cat) return nodes;
    return nodes.filter((n) => cat.kinds.includes(kindOf(n.name, n.type)));
  }, [nodes, filter]);

  const selectedNodes = useMemo(() => visible.filter((n) => selected.includes(n.id)), [visible, selected]);

  /* ---------- 上传 ---------- */
  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (!list.length) return;
      const fd = new FormData();
      fd.set('parentId', currentId ?? '');
      for (const f of list) fd.append('files', f);

      setUploading(true);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || '上传失败');
        const n = data.created?.length ?? 0;
        notify(`上传成功 ${n} 个文件${data.errors?.length ? `，${data.errors.length} 个失败` : ''}`, n > 0);
        reload();
      } catch (e) {
        notify(e instanceof Error ? e.message : '上传失败', false);
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [currentId, notify, reload],
  );

  /* ---------- 操作 ---------- */
  const doCreateFolder = async (name: string) => {
    const res = await fetch('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId: currentId }),
    });
    if (!res.ok) return notify('创建失败', false);
    setDialog(null);
    notify('文件夹已创建');
    reload();
  };

  const doRename = async (id: string, name: string) => {
    const res = await fetch(`/api/nodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return notify('重命名失败', false);
    setDialog(null);
    reload();
  };

  const doMove = async (ids: string[], targetId: string | null) => {
    const res = await fetch('/api/nodes/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, targetId }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return notify(d.error || '移动失败', false);
    setDialog(null);
    notify(`已移动 ${d.moved ?? ids.length} 个项目`);
    reload();
  };

  const doDelete = async (ids: string[]) => {
    const res = await fetch('/api/nodes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) return notify('删除失败', false);
    setDialog(null);
    setSelected([]);
    notify(`已删除 ${ids.length} 个项目`);
    reload();
  };

  const download = (node: FSNodeView) => {
    const a = document.createElement('a');
    a.href = `/api/raw/${node.id}?d=1`;
    a.download = node.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadMany = (list: FSNodeView[]) => {
    list.forEach((n, i) => window.setTimeout(() => download(n), i * 300));
    notify(`开始下载 ${list.length} 个文件`);
  };

  const doShare = (node: FSNodeView) => {
    if (viewOwner) return; // 只读模式禁止分享他人文件
    setShareNode(node);
  };

  /* ---------- 选择 ---------- */
  const onItemClick = (e: React.MouseEvent, node: FSNodeView, index: number) => {
    if (viewOwner) return; // 只读模式不允许选择/操作
    if (e.metaKey || e.ctrlKey) {
      setSelected((s) => (s.includes(node.id) ? s.filter((x) => x !== node.id) : [...s, node.id]));
      lastIndexRef.current = index;
      return;
    }
    if (e.shiftKey && lastIndexRef.current !== null) {
      const [a, b] = [lastIndexRef.current, index].sort((x, y) => x - y);
      setSelected(visible.slice(a, b + 1).map((n) => n.id));
      return;
    }
    setSelected([node.id]);
    lastIndexRef.current = index;
  };

  const onItemDoubleClick = (node: FSNodeView) => {
    if (node.type === 'folder') {
      setQuery('');
      setSearchInput('');
      setFilter('all');
      setCurrentId(node.id);
    } else if (canPreview(kindOf(node.name, node.type))) {
      setPreview(node);
    } else {
      download(node);
    }
  };

  const onContextMenu = (e: React.MouseEvent, node: FSNodeView | null) => {
    e.preventDefault();
    if (viewOwner) return; // 只读模式不弹出操作菜单
    if (node && !selected.includes(node.id)) setSelected([node.id]);
    else if (!node) setSelected([]);
    setMenu({ x: e.clientX, y: e.clientY, id: node?.id ?? null });
  };

  useEffect(() => {
    const close = () => {
      setMenu(null);
      setPickerOpen(false);
    };
    window.addEventListener('click', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, []);

  /* ---------- 拖拽上传 ---------- */
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) uploadFiles(e.dataTransfer.files);
  };

  /* ---------- 快捷键 ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected.length) {
        e.preventDefault();
        setDialog({ type: 'delete', ids: selected });
      }
      if (e.key === 'Escape') setSelected([]);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelected(visible.map((n) => n.id));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, visible]);

  const goUp = () => {
    const parent = path.length > 1 ? path[path.length - 2].id : null;
    setCurrentId(parent);
    setQuery('');
    setSearchInput('');
  };

  const targetIds = selected.length ? selected : menu?.id ? [menu.id] : [];

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6f7f9] text-slate-900">
      {/* ---------------- 侧边栏 ---------------- */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4 md:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <IconCloud width={20} height={20} />
          </span>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold">云盘</p>
            <p className="text-xs text-slate-400">个人文件管理</p>
          </div>
        </div>

        <nav className="space-y-0.5">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = page === 'disk' && filter === c.key;
            return (
              <button
                key={c.key}
                onClick={() => {
                  setPage('disk');
                  setFilter(c.key);
                  setQuery('');
                  setSearchInput('');
                  if (c.key === 'all') setCurrentId(currentId);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon width={17} height={17} />
                {c.label}
              </button>
            );
          })}

          <div className="my-2 border-t border-slate-100" />
          <button
            onClick={() => setPage('settings')}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              page === 'settings' ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <IconSliders width={17} height={17} />
            用户设置
          </button>

          <button
            onClick={() => setPage('shares')}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              page === 'shares' ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <IconShare width={17} height={17} />
            我的分享
          </button>
        </nav>

        <div className="mt-auto space-y-2">
          <div className="rounded-xl bg-slate-50 p-3.5">
            <p className="text-xs text-slate-500">我的空间</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {formatSize(stats.used)}
              <span className="text-sm font-normal text-slate-400"> / {formatSize(stats.quota)}</span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full ${stats.used / stats.quota > 0.9 ? 'bg-red-500' : 'bg-brand-500'}`}
                style={{ width: `${Math.min(100, (stats.used / stats.quota) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              剩余 {formatSize(stats.remaining)} · {stats.fileCount} 文件 / {stats.folderCount} 夹
            </p>
          </div>

          {role === 'admin' && (
            <button
              onClick={() => (window.location.href = '/admin')}
              className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <IconShield width={17} height={17} className="text-slate-500" />
              管理面板
            </button>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            {myAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={myAvatar} alt="头像" className="h-7 w-7 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
                {user.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-medium text-slate-800">{user}</p>
              <p className="text-[11px] text-slate-400">{role === 'admin' ? '管理员' : '普通用户'}</p>
            </div>
            <button onClick={logout} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600" title="退出登录">
              <IconLogout width={16} height={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ---------------- 主区 ---------------- */}
      <main
        className={`relative flex min-w-0 flex-1 flex-col ${dragOver ? 'drag-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragOver(false);
        }}
        onDrop={onDrop}
      >
        {page === 'settings' ? (
          <UserSettings
            user={user}
            role={role}
            avatar={myAvatar}
            onAvatarChange={setMyAvatar}
            notify={notify}
            onBack={() => setPage('disk')}
          />
        ) : page === 'shares' ? (
          <MyShares notify={notify} onBack={() => setPage('disk')} />
        ) : (
        <>
          {/* 顶栏 */}
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <form
            className="relative flex-1 max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(searchInput.trim());
            }}
          >
            <IconSearch
              width={16}
              height={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (!e.target.value) setQuery('');
              }}
              placeholder="搜索文件名称…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm outline-none transition-colors focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setQuery('');
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-200"
              >
                <IconX width={13} height={13} />
              </button>
            )}
          </form>

          <div className="ml-auto flex items-center gap-1">
            {role === 'admin' && !viewOwner && (
              <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); openAccountPicker(); }} className="btn-ghost p-2" title="查看他人文件">
                  <IconEye width={17} height={17} />
                </button>
                {pickerOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop anim-pop">
                    {accounts.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-400">暂无其他账号</p>
                    ) : (
                      accounts.map((a) => (
                        <button
                          key={a}
                          onClick={(e) => { e.stopPropagation(); selectOwner(a); }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                        >
                          <IconUser width={14} height={14} className="shrink-0 text-slate-400" />
                          <span className="truncate">{a}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            <button onClick={reload} className="btn-ghost p-2" title="刷新">
              <IconRefresh width={17} height={17} />
            </button>
            <div className="flex rounded-lg border border-slate-200 p-0.5">
              <button
                onClick={() => setView('grid')}
                className={`rounded-md p-1.5 ${view === 'grid' ? 'bg-brand-50 text-brand-600' : 'text-slate-500 hover:bg-slate-100'}`}
                title="网格视图"
              >
                <IconGrid width={16} height={16} />
              </button>
              <button
                onClick={() => setView('list')}
                className={`rounded-md p-1.5 ${view === 'list' ? 'bg-brand-50 text-brand-600' : 'text-slate-500 hover:bg-slate-100'}`}
                title="列表视图"
              >
                <IconList width={16} height={16} />
              </button>
            </div>
          </div>
        </header>

        {/* 只读横幅（管理员查看他人文件时） */}
        {role === 'admin' && viewOwner && (
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            <IconEye width={15} height={15} className="shrink-0" />
            <span className="truncate">
              你正在以管理员身份查看 <b className="font-semibold">{viewOwner}</b> 的文件（只读）
            </span>
            <button
              onClick={exitView}
              className="ml-auto shrink-0 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
            >
              退出查看
            </button>
          </div>
        )}

        {/* 操作栏 */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
          {selected.length > 0 ? (
            <>
              <span className="text-sm text-slate-500">
                已选中 <b className="text-slate-900">{selected.length}</b> 项
              </span>
              <div className="mx-1 h-4 w-px bg-slate-200" />
              <button className="btn-ghost" onClick={() => downloadMany(selectedNodes)}>
                <IconDownload width={16} height={16} /> 下载
              </button>
              <button
                className="btn-ghost"
                onClick={() => selected.length === 1 && setDialog({ type: 'rename', node: selectedNodes[0] })}
                disabled={selected.length !== 1}
              >
                <IconRename width={16} height={16} /> 重命名
              </button>
              <button className="btn-ghost" onClick={() => setDialog({ type: 'move', ids: selected })}>
                <IconMove width={16} height={16} /> 移动
              </button>
              <button
                className="btn-ghost text-red-600 hover:bg-red-50"
                onClick={() => setDialog({ type: 'delete', ids: selected })}
              >
                <IconTrash width={16} height={16} /> 删除
              </button>
              <button className="btn-ghost ml-auto" onClick={() => setSelected([])}>
                取消选择
              </button>
            </>
          ) : (
            <>
              {!viewOwner && (
                <>
                  <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
                    <IconUpload width={16} height={16} /> 上传文件
                  </button>
                  <button className="btn-outline" onClick={() => setDialog({ type: 'newFolder' })}>
                    <IconFolderPlus width={16} height={16} /> 新建文件夹
                  </button>
                </>
              )}
              <div className="ml-auto flex items-center gap-1">
                <IconSort width={15} height={15} className="text-slate-400" />
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="rounded-lg border border-slate-200 bg-white py-1.5 pl-2 pr-6 text-sm outline-none focus:border-brand-400"
                >
                  {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                    <option key={k} value={k}>
                      按{SORT_LABEL[k]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  title={sortDir === 'asc' ? '升序' : '降序'}
                >
                  {sortDir === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* 面包屑 */}
        <div className="flex items-center gap-1 overflow-x-auto px-4 py-2.5 text-sm">
          <button
            onClick={() => {
              setCurrentId(null);
              setQuery('');
              setSearchInput('');
            }}
            className={`shrink-0 rounded-md px-2 py-1 ${!currentId && !query ? 'font-medium text-slate-900' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            {query ? `搜索“${query}”` : filter !== 'all' ? (CATEGORIES.find((c) => c.key === filter)?.label ?? '全部文件') : '全部文件'}
          </button>
          {path.map((p, i) => (
            <span key={p.id} className="flex shrink-0 items-center gap-1">
              <IconChevronRight width={14} height={14} className="text-slate-300" />
              <button
                onClick={() => setCurrentId(p.id)}
                className={`rounded-md px-2 py-1 ${i === path.length - 1 ? 'font-medium text-slate-900' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                {p.name}
              </button>
            </span>
          ))}
          {(currentId || path.length > 0) && (
            <button onClick={goUp} className="btn-ghost ml-1 shrink-0 px-2 py-1 text-xs" title="返回上级">
              <IconChevronLeft width={14} height={14} /> 上级
            </button>
          )}
          <span className="ml-auto shrink-0 pl-3 text-xs text-slate-400">
            {loading ? '加载中…' : `${visible.length} 个项目`}
          </span>
        </div>

        {/* 内容区 */}
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-8" onClick={() => setSelected([])}>
          {loading && visible.length === 0 ? (
            <div className="grid place-items-center py-24 text-sm text-slate-400">加载中…</div>
          ) : visible.length === 0 ? (
            <EmptyState
              onUpload={() => fileInputRef.current?.click()}
              onNewFolder={() => setDialog({ type: 'newFolder' })}
            />
          ) : view === 'grid' ? (
            <div className="grid gap-3 pt-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))' }}>
              {visible.map((n, i) => (
                <GridItem
                  key={n.id}
                  node={n}
                  active={selected.includes(n.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onItemClick(e, n, i);
                  }}
                  onDoubleClick={() => onItemDoubleClick(n)}
                  onContextMenu={(e) => onContextMenu(e, n)}
                  onDownload={() => download(n)}
                  onPreview={() => setPreview(n)}
                  onShare={() => doShare(n)}
                  readOnly={!!viewOwner}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-xs font-medium text-slate-500">
                <span className="flex-1">名称</span>
                <span className="w-20 text-right">大小</span>
                <span className="w-32 text-right">修改时间</span>
                <span className="w-9" />
              </div>
              {visible.map((n, i) => (
                <ListRow
                  key={n.id}
                  node={n}
                  active={selected.includes(n.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onItemClick(e, n, i);
                  }}
                  onDoubleClick={() => onItemDoubleClick(n)}
                  onContextMenu={(e) => onContextMenu(e, n)}
                  onDownload={() => download(n)}
                  onPreview={() => setPreview(n)}
                  onShare={() => doShare(n)}
                  readOnly={!!viewOwner}
                />
              ))}
            </div>
          )}
        </div>
        </>
        )}

        {/* 拖拽提示 */}
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-brand-50/70">
            <div className="rounded-2xl border-2 border-dashed border-brand-400 bg-white px-8 py-6 text-center shadow-pop">
              <IconUpload width={28} height={28} className="mx-auto text-brand-600" />
              <p className="mt-2 text-sm font-medium text-slate-800">松开鼠标即可上传</p>
              <p className="mt-0.5 text-xs text-slate-500">上传到当前目录</p>
            </div>
          </div>
        )}

        {/* 上传中 */}
        {uploading && (
          <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white shadow-pop">
            正在上传…
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </main>

      {/* ---------------- 右键菜单 ---------------- */}
      {menu && (
        <div
          className="fixed z-[70] w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop anim-pop"
          style={{ left: Math.min(menu.x, window.innerWidth - 190), top: Math.min(menu.y, window.innerHeight - 240) }}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem
            icon={<IconEye width={15} height={15} />}
            label="预览"
            disabled={selected.length !== 1 || !selectedNodes[0] || selectedNodes[0].type !== 'file' || !canPreview(kindOf(selectedNodes[0].name, 'file'))}
            onClick={() => {
              setPreview(selectedNodes[0]);
              setMenu(null);
            }}
          />
          <MenuItem
            icon={<IconDownload width={15} height={15} />}
            label="下载"
            disabled={!menu.id || (selectedNodes.length === 1 && selectedNodes[0].type === 'folder')}
            onClick={() => {
              downloadMany(selectedNodes.filter((n) => n.type === 'file'));
              setMenu(null);
            }}
          />
          <MenuItem
            icon={<IconRename width={15} height={15} />}
            label="重命名"
            disabled={selected.length !== 1}
            onClick={() => {
              setDialog({ type: 'rename', node: selectedNodes[0] });
              setMenu(null);
            }}
          />
          <MenuItem
            icon={<IconMove width={15} height={15} />}
            label="移动到"
            disabled={!targetIds.length}
            onClick={() => {
              setDialog({ type: 'move', ids: targetIds });
              setMenu(null);
            }}
          />
          <MenuItem
            icon={<IconShare width={15} height={15} />}
            label="分享"
            disabled={selected.length !== 1}
            onClick={() => {
              doShare(selectedNodes[0]);
              setMenu(null);
            }}
          />
          <div className="my-1 h-px bg-slate-100" />
          <MenuItem
            icon={<IconTrash width={15} height={15} />}
            label="删除"
            danger
            disabled={!targetIds.length}
            onClick={() => {
              setDialog({ type: 'delete', ids: targetIds });
              setMenu(null);
            }}
          />
        </div>
      )}

      {/* ---------------- 弹窗 ---------------- */}
      {preview && <PreviewModal node={preview} onClose={() => setPreview(null)} />}

      {shareNode && (
        <ShareDialog node={shareNode} onClose={() => setShareNode(null)} notify={notify} />
      )}

      {dialog?.type === 'newFolder' && (
        <NameDialog
          title="新建文件夹"
          label="文件夹名称"
          defaultValue="新建文件夹"
          confirmText="创建"
          onClose={() => setDialog(null)}
          onSubmit={doCreateFolder}
        />
      )}
      {dialog?.type === 'rename' && (
        <NameDialog
          title="重命名"
          label="新的名称"
          defaultValue={dialog.node.name}
          confirmText="保存"
          onClose={() => setDialog(null)}
          onSubmit={(name) => doRename(dialog.node.id, name)}
        />
      )}
      {dialog?.type === 'move' && (
        <MoveDialog count={dialog.ids.length} onClose={() => setDialog(null)} onConfirm={(t) => doMove(dialog.ids, t)} />
      )}
      {dialog?.type === 'delete' && (
        <ConfirmDialog
          title="确认删除"
          danger
          confirmText="删除"
          message={
            <>
              确定要删除选中的 <b>{dialog.ids.length}</b> 个项目吗？
              <span className="mt-1 block text-slate-500">文件夹内的所有内容也会一并删除，该操作不可恢复。</span>
            </>
          }
          onClose={() => setDialog(null)}
          onConfirm={() => doDelete(dialog.ids)}
        />
      )}

      {/* ---------------- Toast ---------------- */}
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

/* ================= 子组件 ================= */

function EmptyState({ onUpload, onNewFolder }: { onUpload: () => void; onNewFolder: () => void }) {
  return (
    <div className="grid place-items-center py-24">
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-slate-400">
          <IconCloud width={30} height={30} />
        </div>
        <p className="mt-4 text-sm font-medium text-slate-700">这里还是空的</p>
        <p className="mt-1 text-xs text-slate-400">拖拽文件到此，或点击下面的按钮开始</p>
        <div className="mt-5 flex justify-center gap-2">
          <button className="btn-primary" onClick={onUpload}>
            <IconUpload width={16} height={16} /> 上传文件
          </button>
          <button className="btn-outline" onClick={onNewFolder}>
            <IconFolderPlus width={16} height={16} /> 新建文件夹
          </button>
        </div>
      </div>
    </div>
  );
}

function GridItem({
  node,
  active,
  onClick,
  onDoubleClick,
  onContextMenu,
  onDownload,
  onPreview,
  onShare,
  readOnly,
}: {
  node: FSNodeView;
  active: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDownload: () => void;
  onPreview: () => void;
  onShare: () => void;
  readOnly?: boolean;
}) {
  const kind = kindOf(node.name, node.type);
  const previewable = node.type === 'file' && canPreview(kind);
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={`group relative cursor-default rounded-xl border p-3 transition-all ${
        active ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-100' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-card'
      }`}
    >
      <div className="grid place-items-center py-3">
        <FileIcon kind={kind} name={node.name} size={48} />
      </div>
      <p className="mt-2 truncate text-center text-[13px] font-medium text-slate-800" title={node.name}>
        {node.name}
      </p>
      <p className="mt-0.5 truncate text-center text-[11px] text-slate-400">
        {node.type === 'folder'
          ? `${node.itemCount ?? 0} 项`
          : `${formatSize(node.size)} · ${formatTime(node.updatedAt).slice(5, 16)}`}
      </p>
      <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
        {previewable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            className="rounded-lg bg-white/90 p-1.5 text-slate-500 shadow-sm ring-1 ring-slate-200 hover:text-brand-600"
            title="预览"
          >
            <IconEye width={14} height={14} />
          </button>
        )}
        {!readOnly && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare();
            }}
            className="rounded-lg bg-white/90 p-1.5 text-slate-500 shadow-sm ring-1 ring-slate-200 hover:text-brand-600"
            title="分享"
          >
            <IconShare width={14} height={14} />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          className="rounded-lg bg-white/90 p-1.5 text-slate-500 shadow-sm ring-1 ring-slate-200 hover:text-brand-600"
          title="下载"
        >
          <IconDownload width={14} height={14} />
        </button>
      </div>
    </div>
  );
}

function ListRow({
  node,
  active,
  onClick,
  onDoubleClick,
  onContextMenu,
  onDownload,
  onPreview,
  onShare,
  readOnly,
}: {
  node: FSNodeView;
  active: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDownload: () => void;
  onPreview: () => void;
  onShare: () => void;
  readOnly?: boolean;
}) {
  const kind = kindOf(node.name, node.type);
  const previewable = node.type === 'file' && canPreview(kind);
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={`group flex cursor-default items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 ${
        active ? 'bg-brand-50/70' : 'hover:bg-slate-50'
      }`}
    >
      <FileIcon kind={kind} name={node.name} size={30} rounded="rounded-lg" />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-800" title={node.name}>
        {node.name}
      </span>
      <span className="w-20 text-right text-xs text-slate-500">
        {node.type === 'folder' ? `${node.itemCount ?? 0} 项` : formatSize(node.size)}
      </span>
      <span className="w-32 text-right text-xs text-slate-400">{formatTime(node.updatedAt)}</span>
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {previewable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
            title="预览"
          >
            <IconEye width={15} height={15} />
          </button>
        )}
        {!readOnly && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare();
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
            title="分享"
          >
            <IconShare width={15} height={15} />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
          title="下载"
        >
          {node.type === 'file' ? <IconDownload width={15} height={15} /> : <IconDots width={15} height={15} />}
        </button>
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
        disabled
          ? 'cursor-not-allowed text-slate-300'
          : danger
            ? 'text-red-600 hover:bg-red-50'
            : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
