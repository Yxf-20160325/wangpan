import fs from 'node:fs';
import { Readable } from 'node:stream';
import { NextRequest, NextResponse } from 'next/server';

/** 生成 Content-Disposition 头，兼容中文文件名（RFC 5987 + ASCII 兜底） */
export function disposition(mode: 'inline' | 'attachment', name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  const asciiBase = base
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/["\\]/g, '_')
    .trim();
  const fallback = `${asciiBase || 'download'}${ext.replace(/[^\x20-\x7e.]/g, '')}`;
  return `${mode}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * 统一的文件流输出，支持 Range 断点续传。
 * @param mode attachment=强制下载, inline=尽量内联预览（HTML 会被降级为纯文本，避免脚本注入）
 */
export function serveFile(
  req: NextRequest,
  filePath: string,
  mime: string | null,
  name: string,
  mode: 'inline' | 'attachment',
): NextResponse {
  if (!fs.existsSync(filePath)) return new NextResponse('文件已丢失', { status: 404 });

  let resolvedMime = mime || 'application/octet-stream';
  if (mode === 'inline') {
    if (/html/i.test(resolvedMime)) resolvedMime = 'text/plain; charset=utf-8';
    if (!mime) resolvedMime = 'application/octet-stream';
  }

  const stat = fs.statSync(filePath);
  const headers: Record<string, string> = {
    'Content-Type': resolvedMime,
    'Content-Disposition': disposition(mode, name),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=0, must-revalidate',
  };

  const range = req.headers.get('range');
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const start = m[1] ? Number(m[1]) : 0;
      const end = m[2] ? Number(m[2]) : stat.size - 1;
      if (start >= 0 && end >= start && end < stat.size) {
        headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
        headers['Content-Length'] = String(end - start + 1);
        const stream = Readable.toWeb(fs.createReadStream(filePath, { start, end })) as unknown as ReadableStream;
        return new NextResponse(stream, { status: 206, headers });
      }
    }
  }

  headers['Content-Length'] = String(stat.size);
  const stream = Readable.toWeb(fs.createReadStream(filePath)) as unknown as ReadableStream;
  return new NextResponse(stream, { status: 200, headers });
}
