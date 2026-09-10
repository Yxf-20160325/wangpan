// 管理面板权限注册表：前后端共用的唯一事实来源。
// 一个权限点对应管理面板的某个功能入口（查看某 tab / 执行某动作）。
// 创建账号、编辑用户权限时均以此为清单，确保「权限控制项目要全」。

export type PermissionKey =
  // 概览
  | 'overview:view'
  // 全局文件
  | 'files:view'
  | 'files:delete'
  // 操作日志
  | 'logs:view'
  | 'logs:clear'
  // 登录会话
  | 'sessions:view'
  | 'sessions:kick'
  // 分享管理
  | 'shares:view'
  | 'shares:revoke'
  // 用户管理
  | 'users:view'
  | 'users:create'
  | 'users:edit'
  | 'users:delete'
  | 'users:ban'
  | 'users:permissions'
  // 系统设置
  | 'settings:view'
  | 'settings:access'
  | 'settings:clear';

export interface PermissionDef {
  key: PermissionKey;
  label: string;
}

export interface PermissionGroup {
  group: string;
  items: PermissionDef[];
}

// 分组顺序即管理面板 tab 顺序；每个 tab 至少含一个「查看」权限点。
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group: '概览',
    items: [{ key: 'overview:view', label: '查看概览' }],
  },
  {
    group: '全局文件',
    items: [
      { key: 'files:view', label: '查看全局文件' },
      { key: 'files:delete', label: '删除文件' },
    ],
  },
  {
    group: '操作日志',
    items: [
      { key: 'logs:view', label: '查看操作日志' },
      { key: 'logs:clear', label: '清空操作日志' },
    ],
  },
  {
    group: '登录会话',
    items: [
      { key: 'sessions:view', label: '查看登录会话' },
      { key: 'sessions:kick', label: '强制退出会话' },
    ],
  },
  {
    group: '分享管理',
    items: [
      { key: 'shares:view', label: '查看分享管理' },
      { key: 'shares:revoke', label: '撤销分享链接' },
    ],
  },
  {
    group: '用户管理',
    items: [
      { key: 'users:view', label: '查看用户列表' },
      { key: 'users:create', label: '新建用户' },
      { key: 'users:edit', label: '修改用户（角色 / 重置密码）' },
      { key: 'users:delete', label: '删除用户' },
      { key: 'users:ban', label: '封禁 / 解封用户' },
      { key: 'users:permissions', label: '管理用户权限' },
    ],
  },
  {
    group: '系统设置',
    items: [
      { key: 'settings:view', label: '查看设置' },
      { key: 'settings:access', label: '修改访问设置（注册 / 登录开关）' },
      { key: 'settings:clear', label: '清空全部数据' },
    ],
  },
];

/** 全部权限点（创建管理员时默认全选） */
export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_GROUPS.flatMap((g) =>
  g.items.map((i) => i.key),
);

/** 权限点 -> 中文标签 */
export const PERMISSION_LABELS: Record<PermissionKey, string> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label])),
) as Record<PermissionKey, string>;

/** 管理面板 tab -> 进入该 tab 所需的「查看」权限点 */
export const TAB_VIEW_PERMISSION: Record<string, PermissionKey> = {
  overview: 'overview:view',
  files: 'files:view',
  logs: 'logs:view',
  sessions: 'sessions:view',
  shares: 'shares:view',
  users: 'users:view',
  settings: 'settings:view',
};

/** 判断字符串是否为合法权限点（用于接口入参校验） */
export function isPermissionKey(v: unknown): v is PermissionKey {
  return typeof v === 'string' && (ALL_PERMISSIONS as string[]).includes(v);
}
