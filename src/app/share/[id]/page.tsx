'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import FileIcon from '@/components/FileIcon';
import { IconCloud, IconDownload, IconEye, IconFolder, IconX } from '@/components/Icons';
import { canPreview, kindOf } from '@/lib/fileKind';
import { formatSize, formatTime } from '@/lib/format';
import { renderMarkdown } from '@/lib/markdown';

interface ShareChild {
  id: string;
  name: string;
  size: number;
  mime: string | null;
  path: string;
}

interface ShareData {
  id: string;
  nodeId: string;
  name: string;
  type: 'file' | 'folder';
  size: number;
  mime: string | null;
  expireAt: string | null;
  createdAt: string;
  children: ShareChild[];
}

export default function SharePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState('');
  const [activeFile, setActiveFile] = useState<{ id: string; name: string; mime: string | null; kind: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [text, setText] = useState<string | null>(null);
  const [textError, setTextError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/share/${id}`)
      .then(async (r) => {
        if (r.status === 404) {
          setError('该分享链接已失效或不存在（可能已撤销、过期或原文件被删除）。');
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d) setData(d);
      })
      .catch(() => setError('加载分享内容失败，请稍后重试。'))
      .finally(() => setLoading(false));
  }, [id]);

  const dl = useCallback(
    (fileId?: string) => `/api/share/${id}/download${fileId ? `?file=${encodeURIComponent(fileId)}` : ''}`,
    [id],
  );
  const inline = useCallback(
    (fileId?: string) => `${dl(fileId)}&inline=1`,
    [dl],
  );

  // 单文件分享：默认直接展示预览
  useEffect(() => {
    if (data && data.type === 'file') {
      openPreview({ id: data.nodeId, name: data.name, mime: data.mime });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const openPreview = useCallback(
    (file: { id: string; name: string; mime: string | null }) => {
      const kind = kindOf(file.name, 'file');
      const isMarkdown = kind === 'text' && /\.(md|markdown)$/i.test(file.name);
      const previewable = canPreview(kind) || isMarkdown;
      setActiveFile({ id: file.id, name: file.name, mime: file.mime, kind });
      setTextError('');
      setText(null);

      if (!previewable) {
        setPreviewUrl('');
        return;
      }
      if (kind === 'text' || kind === 'code' || isMarkdown) {
        setPreviewUrl('');
        fetch(inline(file.id))
          .then((r) => r.text())
          .then((t) => setText(t.length > 400_000 ? t.slice(0, 400_000) + '\n\n……内容过大，仅显示前 400 KB' : t))
          .catch(() => setTextError('读取失败'));
      } else {
        setPreviewUrl(inline(file.id));
      }
    },
    [inline],
  );

  const isMarkdown = activeFile && activeFile.kind === 'text' && /\.(md|markdown)$/i.test(activeFile.name);

  const childList = useMemo(() => {
    if (!data || data.type !== 'folder') return [];
    return [...data.children].sort((a, b) => {
      const ka = kindOf(a.name, 'file');
      const kb = kindOf(b.name, 'file');
      if (ka !== kb) return ka === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });
  }, [data]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eef2f7] to-[#f6f7f9]">
      {/* 顶栏 */}
      <header className="flex items-center gap-2.5 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
          <IconCloud width={18} height={18} />
        </span>
        <span className="text-[15px] font-semibold text-slate-800">云盘 · 文件分享</span>
        <span className="ml-auto text-xs text-slate-400">免费分享 · 无需登录</span>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        {loading ? (
          <div className="grid place-items-center py-24 text-sm text-slate-400">加载中…</div>
        ) : error ? (
          <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <IconX width={26} height={26} />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-700">链接不可用</p>
            <p className="mt-1.5 text-sm text-slate-500">{error}</p>
          </div>
        ) : data ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* 头部信息 */}
            <div className="flex items-center gap-4 border-b border-slate-100 p-5">
              <FileIcon kind={kindOf(data.name, data.type)} name={data.name} size={54} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-slate-900" title={data.name}>
                  {data.name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {data.type === 'folder'
                    ? `文件夹 · 共 ${data.children.length} 个文件`
                    : `${formatSize(data.size)}`}
                  {data.expireAt && ` · 分享于 ${formatTime(data.createdAt)}`}
                </p>
                {data.expireAt ? (
                  <p className="mt-0.5 text-xs text-amber-600">该链接将于 {formatTime(data.expireAt)} 过期</p>
                ) : (
                  <p className="mt-0.5 text-xs text-slate-400">永久有效</p>
                )}
              </div>
              {data.type === 'file' && (
                <a href={dl()} target="_blank" rel="noreferrer" className="btn-primary shrink-0">
                  <IconDownload width={16} height={16} /> 下载
                </a>
              )}
            </div>

            {/* 文件预览 / 文件夹列表 */}
            {data.type === 'file' && activeFile ? (
              <PreviewBlock
                file={activeFile}
                url={previewUrl}
                text={text}
                textError={textError}
                isMarkdown={!!isMarkdown}
                downloadUrl={dl()}
              />
            ) : (
              <div className="p-2">
                {childList.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-400">该文件夹为空</p>
                ) : (
                  <ul>
                    {childList.map((c) => {
                      const kind = kindOf(c.name, 'file');
                      const previewable = canPreview(kind) || (kind === 'text' && /\.(md|markdown)$/i.test(c.name));
                      return (
                        <li
                          key={c.id}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50"
                        >
                          <FileIcon kind={kind} name={c.name} size={30} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-slate-800" title={c.name}>
                              {c.name}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              {c.path ? `${c.path} · ` : ''}
                              {formatSize(c.size)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {previewable && (
                              <button
                                onClick={() => openPreview(c)}
                                title="预览"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                              >
                                <IconEye width={15} height={15} />
                              </button>
                            )}
                            <a
                              href={dl(c.id)}
                              target="_blank"
                              rel="noreferrer"
                              title="下载"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                            >
                              <IconDownload width={15} height={15} />
                            </a>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {activeFile && (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <button
                      onClick={() => setActiveFile(null)}
                      className="mb-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-brand-600 hover:bg-brand-50"
                    >
                      <IconX width={15} height={15} /> 关闭预览 · 返回列表
                    </button>
                    <PreviewBlock
                      file={activeFile}
                      url={previewUrl}
                      text={text}
                      textError={textError}
                      isMarkdown={!!isMarkdown}
                      downloadUrl={dl(activeFile.id)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-slate-400">
          由云盘提供免费分享服务 · 链接有效期内任何人都可访问
        </p>
      </main>
    </div>
  );
}

function PreviewBlock({
  file,
  url,
  text,
  textError,
  isMarkdown,
  downloadUrl,
}: {
  file: { id: string; name: string; mime: string | null; kind: string };
  url: string;
  text: string | null;
  textError: string;
  isMarkdown: boolean;
  downloadUrl: string;
}) {
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="truncate text-sm font-medium text-slate-700" title={file.name}>
          {file.name}
        </p>
        <a href={downloadUrl} target="_blank" rel="noreferrer" className="btn-outline shrink-0 py-1.5">
          <IconDownload width={15} height={15} /> 下载
        </a>
      </div>

      <div className="flex max-h-[60vh] items-center justify-center overflow-auto rounded-xl bg-slate-50 p-3">
        {file.kind === 'image' && url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={file.name} className="max-h-[58vh] max-w-full rounded-lg object-contain" />
        )}
        {file.kind === 'video' && url && (
          <video src={url} controls className="max-h-[58vh] max-w-full rounded-lg" />
        )}
        {file.kind === 'audio' && url && (
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="mb-4 text-sm text-slate-500">{file.name}</p>
            <audio src={url} controls className="w-full" />
          </div>
        )}
        {file.kind === 'pdf' && url && (
          <iframe src={url} className="h-[58vh] w-full rounded-lg bg-white" title={file.name} />
        )}
        {(file.kind === 'text' || file.kind === 'code') && (
          <div className="h-[58vh] w-full overflow-auto rounded-lg bg-white p-4">
            {textError ? (
              <p className="text-sm text-red-600">{textError}</p>
            ) : text === null ? (
              <p className="text-sm text-slate-400">加载中…</p>
            ) : isMarkdown ? (
              <div className="text-[14px]">{renderMarkdown(text)}</div>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-slate-800">
                {text}
              </pre>
            )}
          </div>
        )}
        {!['image', 'video', 'audio', 'pdf', 'text', 'code'].includes(file.kind) && (
          <div className="rounded-2xl bg-white px-10 py-12 text-center shadow-sm">
            <p className="text-[15px] font-medium text-slate-800">该文件类型暂不支持在线预览</p>
            <p className="mt-1.5 text-sm text-slate-500">请下载到本地后打开</p>
            <a href={downloadUrl} className="btn-primary mt-5" target="_blank" rel="noreferrer">
              <IconDownload width={16} height={16} /> 下载文件
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
