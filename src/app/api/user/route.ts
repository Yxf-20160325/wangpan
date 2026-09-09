import { NextRequest, NextResponse } from 'next/server';
import { currentUser, currentUserRecord, guardApi } from '@/lib/auth';
import { updateOwnAccount, updateOwnAvatar, deleteOwnAccount, AuthError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MAX_AVATAR = 256 * 1024; // 256KB

export async function GET() {
  const guard = await guardApi();
  if (guard) return guard;
  const rec = await currentUserRecord();
  return NextResponse.json({
    user: rec?.username ?? '',
    role: rec?.role ?? 'user',
    avatar: rec?.avatar ?? '',
  });
}

export async function POST(req: NextRequest) {
  const guard = await guardApi();
  if (guard) return guard;

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    currentPassword?: string;
    username?: string;
    password?: string;
    avatar?: string | null;
  };

  const user = await currentUser();

  try {
    if (body.action === 'update') {
      const onlyAvatar =
        body.avatar !== undefined && !body.username && !body.password;

      // 仅改头像：无需当前密码
      if (onlyAvatar) {
        const av = body.avatar ?? '';
        if (av && !av.startsWith('data:image/')) {
          return NextResponse.json({ error: '头像格式不正确' }, { status: 400 });
        }
        if (av && av.length > MAX_AVATAR) {
          return NextResponse.json({ error: '头像图片过大（上限 256KB）' }, { status: 400 });
        }
        await updateOwnAvatar(user, av || null);
        return NextResponse.json({ ok: true, needReauth: false, message: '头像已更新' });
      }

      if (!body.currentPassword) {
        return NextResponse.json({ error: '请输入当前密码' }, { status: 400 });
      }
      // 头像校验
      if (body.avatar !== undefined) {
        if (body.avatar && !body.avatar.startsWith('data:image/')) {
          return NextResponse.json({ error: '头像格式不正确' }, { status: 400 });
        }
        if (body.avatar && body.avatar.length > MAX_AVATAR) {
          return NextResponse.json({ error: '头像图片过大（上限 256KB）' }, { status: 400 });
        }
      }
      await updateOwnAccount(user, {
        currentPassword: body.currentPassword,
        username: body.username,
        password: body.password,
        avatar: body.avatar,
      });
      const renamed = body.username && body.username.trim() && body.username.trim() !== user;
      const pwChanged = !!body.password;
      return NextResponse.json({
        ok: true,
        needReauth: renamed || pwChanged,
        message:
          renamed || pwChanged ? '已保存，将退出并重新登录' : '资料已更新',
      });
    }

    if (body.action === 'delete') {
      if (!body.currentPassword) {
        return NextResponse.json({ error: '请输入当前密码' }, { status: 400 });
      }
      await deleteOwnAccount(user, body.currentPassword);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: '操作失败，请稍后重试' }, { status: 500 });
  }
}

export async function DELETE() {
  const guard = await guardApi();
  if (guard) return guard;
  const user = await currentUser();
  try {
    await deleteOwnAccount(user, '');
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: '操作失败，请稍后重试' }, { status: 500 });
  }
}
