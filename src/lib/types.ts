export type NodeType = 'folder' | 'file';

export interface FSNode {
  id: string;
  name: string;
  type: NodeType;
  parentId: string | null;
  /** 所属账号（用户名）；用于按账号隔离文件 */
  owner: string;
  /** 文件字节数；文件夹为 0 */
  size: number;
  mime: string | null;
  /** 磁盘上的存储文件名（仅文件） */
  store: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 分享链接记录 */
export interface ShareRecord {
  id: string;
  /** 被分享的节点（文件或文件夹）id */
  nodeId: string;
  /** 创建分享的账号 */
  owner: string;
  createdAt: string;
  /** 过期时间（ISO 字符串）；null 表示永久有效 */
  expireAt: string | null;
}

export interface DbShape {
  nodes: FSNode[];
  shares: ShareRecord[];
}

export type SortKey = 'name' | 'size' | 'updatedAt' | 'type';
export type SortDir = 'asc' | 'desc';

/** 返回给前端的节点，文件夹附带聚合信息 */
export interface FSNodeView extends FSNode {
  itemCount?: number;
  totalSize?: number;
}

export interface ApiListResult {
  nodes: FSNodeView[];
  path: { id: string; name: string }[];
  total: number;
}
