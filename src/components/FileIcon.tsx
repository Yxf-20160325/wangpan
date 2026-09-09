'use client';

import type { ComponentType } from 'react';
import { IconArchive, IconAudio, IconCode, IconDoc, IconFile, IconFolder, IconImage, IconVideo } from './Icons';
import { KIND_STYLE, type Kind } from '@/lib/fileKind';
import { extOf } from '@/lib/format';

const GLYPH: Record<Kind, ComponentType<{ width?: number; height?: number }>> = {
  image: IconImage,
  video: IconVideo,
  audio: IconAudio,
  pdf: IconDoc,
  text: IconDoc,
  code: IconCode,
  archive: IconArchive,
  doc: IconDoc,
  sheet: IconDoc,
  slide: IconDoc,
  folder: IconFolder,
  other: IconFile,
};

interface Props {
  kind: Kind;
  name: string;
  size?: number;
  rounded?: string;
}

export default function FileIcon({ kind, name, size = 44, rounded = 'rounded-xl' }: Props) {
  const style = KIND_STYLE[kind];
  const Glyph = GLYPH[kind];

  if (kind === 'folder') {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center ${rounded}`}
        style={{ width: size, height: size, background: style.bg, color: style.fg }}
      >
        <IconFolder width={size * 0.58} height={size * 0.58} fill={style.fg} strokeWidth={1.4} />
      </span>
    );
  }

  const ext = extOf(name).slice(0, 4);

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${rounded}`}
      style={{ width: size, height: size, background: style.bg, color: style.fg }}
    >
      <Glyph width={size * 0.5} height={size * 0.5} />
      {ext ? (
        <span
          className="absolute bottom-0 left-0 right-0 text-center font-semibold uppercase leading-none tracking-tight"
          style={{ fontSize: Math.max(7, size * 0.15), paddingBottom: Math.max(1.5, size * 0.045), color: style.fg, opacity: 0.85 }}
        >
          {ext}
        </span>
      ) : null}
    </span>
  );
}
