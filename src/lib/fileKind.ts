import { extOf } from './format';

export type Kind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'code' | 'archive' | 'doc' | 'sheet' | 'slide' | 'folder' | 'other';

const MAP: Record<string, Kind> = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', bmp: 'image', svg: 'image', avif: 'image', heic: 'image', ico: 'image',
  mp4: 'video', webm: 'video', mov: 'video', mkv: 'video', avi: 'video', m4v: 'video', flv: 'video',
  mp3: 'audio', wav: 'audio', flac: 'audio', aac: 'audio', ogg: 'audio', m4a: 'audio',
  pdf: 'pdf',
  txt: 'text', md: 'text', log: 'text', rtf: 'text',
  json: 'code', js: 'code', ts: 'code', tsx: 'code', jsx: 'code', html: 'code', css: 'code', scss: 'code',
  py: 'code', java: 'code', go: 'code', rs: 'code', c: 'code', cpp: 'code', h: 'code', sh: 'code', yml: 'code', yaml: 'code', xml: 'code', sql: 'code',
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive', dmg: 'archive', iso: 'archive',
  doc: 'doc', docx: 'doc', wps: 'doc', pages: 'doc',
  xls: 'sheet', xlsx: 'sheet', csv: 'sheet', numbers: 'sheet',
  ppt: 'slide', pptx: 'slide', key: 'slide',
};

export function kindOf(name: string, type: 'file' | 'folder'): Kind {
  if (type === 'folder') return 'folder';
  return MAP[extOf(name)] ?? 'other';
}

export const KIND_LABEL: Record<Kind, string> = {
  image: '图片', video: '视频', audio: '音频', pdf: 'PDF', text: '文本', code: '代码',
  archive: '压缩包', doc: '文档', sheet: '表格', slide: '演示', folder: '文件夹', other: '文件',
};

/** 图标配色：文字色 + 浅底 */
export const KIND_STYLE: Record<Kind, { fg: string; bg: string }> = {
  image: { fg: '#0ea5e9', bg: '#e0f2fe' },
  video: { fg: '#8b5cf6', bg: '#ede9fe' },
  audio: { fg: '#f59e0b', bg: '#fef3c7' },
  pdf: { fg: '#ef4444', bg: '#fee2e2' },
  text: { fg: '#64748b', bg: '#f1f5f9' },
  code: { fg: '#0f766e', bg: '#ccfbf1' },
  archive: { fg: '#a16207', bg: '#fef9c3' },
  doc: { fg: '#2563eb', bg: '#dbeafe' },
  sheet: { fg: '#16a34a', bg: '#dcfce7' },
  slide: { fg: '#ea580c', bg: '#ffedd5' },
  folder: { fg: '#f59e0b', bg: '#fff7ed' },
  other: { fg: '#475569', bg: '#eef2f7' },
};

export function canPreview(kind: Kind): boolean {
  return kind === 'image' || kind === 'video' || kind === 'audio' || kind === 'pdf' || kind === 'text' || kind === 'code';
}
