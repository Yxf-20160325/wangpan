import { NextRequest, NextResponse } from 'next/server';
import { readDb, saveFile, QuotaExceededError } from '@/lib/store';
import { currentSession, guardApi } from '@/lib/auth';
import { appendLog } from '@/lib/log';
import type { FSNode } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const denied = await guardApi();
  if (denied) return denied;

  const session = await currentSession();
  if (!session) return NextResponse.json({ error: '未登录或会话已失效' }, { status: 401 });
  const owner = session.username;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: '请求格式错误' }, { status: 400 });

  const parentIdRaw = form.get('parentId');
  const parentId = typeof parentIdRaw === 'string' && parentIdRaw ? parentIdRaw : null;

  const db = await readDb();
  if (parentId) {
    const parent = db.nodes.find((n) => n.id === parentId && n.type === 'folder');
    if (!parent) return NextResponse.json({ error: '目标文件夹不存在' }, { status: 404 });
  }

  const created: FSNode[] = [];
  const errors: string[] = [];

  for (const [, value] of form.entries()) {
    if (typeof value === 'string') continue;
    if (!value || typeof (value as Blob).arrayBuffer !== 'function') continue;
    const file = value as File;
    if (!file.name) continue;
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const node = await saveFile({
        parentId,
        name: file.name,
        mime: file.type || null,
        buffer: buf,
        owner,
      });
      created.push(node);
    } catch (e) {
      if (e instanceof QuotaExceededError) {
        return NextResponse.json({ error: e.message }, { status: 413 });
      }
      errors.push(`${file.name}: ${e instanceof Error ? e.message : '上传失败'}`);
    }
  }

  if (created.length) {
    const targetName = parentId ? db.nodes.find((n) => n.id === parentId)?.name : '全部文件';
    appendLog({
      action: 'upload',
      target: created.map((f) => f.name).join('、'),
      detail: `位置：${targetName ?? '全部文件'}`,
      user: owner,
    });
  }

  return NextResponse.json({ created, errors });
}
