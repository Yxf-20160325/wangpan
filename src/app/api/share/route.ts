import { NextRequest, NextResponse } from 'next/server';
import { currentSession, guardApi } from '@/lib/auth';
import { createShare, listShares, readDb } from '@/lib/store';
import type { ShareRecord } from '@/lib/types';

export const dynamic = 'force-dynamic';

const TTL_DAYS = new Set([0, 1, 7, 30]);

interface ShareView extends ShareRecord {
  name: string;
  type: 'file' | 'folder';
  size: number;
  expired: boolean;
}

// 自动识别访问来源：优先取反向代理（如 Railway）下发的 x-forwarded-* 头，
// 没有则退回 Host。这样 localhost 访问得到 http://localhost:3000，
// 走公网域名得到 https://wangpan-production.up.railway.app，无需硬编码。
function getRequestOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedProto = (req.headers.get('x-forwarded-proto') || '').split(',')[0].trim();
  const host = forwardedHost || req.headers.get('host');
  if (!host) return new URL(req.url).origin;
  const proto =
    forwardedProto ||
    (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  const denied = await guardApi();
  if (denied) return denied;

  const session = await currentSession();

  const body = (await req.json().catch(() => ({}))) as { nodeId?: string; ttl?: number };
  const nodeId = body.nodeId;
  const ttl = typeof body.ttl === 'number' && TTL_DAYS.has(body.ttl) ? body.ttl : 0;
  if (!nodeId) return NextResponse.json({ error: '缺少 nodeId' }, { status: 400 });

  const username = session?.username;
  const role = session?.role;
  if (!username) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const db = await readDb();
  const node = db.nodes.find((n) => n.id === nodeId);
  if (!node) return NextResponse.json({ error: '文件不存在' }, { status: 404 });
  // 普通用户只能分享自己名下的文件；管理员可分享任意文件
  if (role !== 'admin' && node.owner !== username) {
    return NextResponse.json({ error: '无权分享该文件' }, { status: 403 });
  }

  const rec = await createShare({ nodeId, owner: username, ttlDays: ttl });
  if (!rec) return NextResponse.json({ error: '分享失败' }, { status: 500 });

  const origin = getRequestOrigin(req);
  return NextResponse.json({
    id: rec.id,
    url: `${origin}/share/${rec.id}`,
    expireAt: rec.expireAt,
  });
}

export async function GET(req: NextRequest) {
  const denied = await guardApi();
  if (denied) return denied;

  const session = await currentSession();

  const { searchParams } = new URL(req.url);
  const nodeId = searchParams.get('nodeId');
  const all = searchParams.get('all') === '1';

  const db = await readDb();
  const shares = await listShares(all && session?.role === 'admin' ? undefined : session?.username);

  const views: ShareView[] = shares.map((s) => {
    const node = db.nodes.find((n) => n.id === s.nodeId);
    const expired = !!s.expireAt && Date.parse(s.expireAt) < Date.now();
    return {
      ...s,
      name: node?.name ?? '（已删除）',
      type: node?.type ?? 'file',
      size: node?.size ?? 0,
      expired,
    };
  });

  // 按 nodeId 过滤（只看某个文件的分享）
  const filtered = nodeId ? views.filter((v) => v.nodeId === nodeId) : views;
  const origin = getRequestOrigin(req);

  return NextResponse.json({
    shares: filtered.map((v) => ({ ...v, url: `${origin}/share/${v.id}` })),
  });
}
