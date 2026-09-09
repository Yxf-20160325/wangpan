import { type ReactElement } from 'react';

/** 极简安全的 Markdown 渲染：仅支持有限语法，所有文本先转义，杜绝 XSS。 */
export function renderMarkdown(src: string): ReactElement[] {
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');

  const lines = src.split('\n');
  const out: ReactElement[] = [];
  let list: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];

  const flushList = (key: string) => {
    if (!list.length) return;
    out.push(
      <ul key={key} className="my-2 list-disc space-y-1 pl-5 text-slate-700">
        {list.map((li, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: inline(li) }} />
        ))}
      </ul>,
    );
    list = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.replace(/\s+$/, '');
    if (/^```/.test(line)) {
      if (inCode) {
        out.push(
          <pre key={`c${idx}`} className="my-2 overflow-auto rounded-lg bg-slate-900 p-3 text-[12px] leading-relaxed text-slate-100">
            <code>{codeBuf.join('\n')}</code>
          </pre>,
        );
        codeBuf = [];
        inCode = false;
      } else {
        flushList(`l${idx}`);
        inCode = true;
      }
      return;
    }
    if (inCode) {
      codeBuf.push(line);
      return;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      list.push(line.replace(/^\s*[-*]\s+/, ''));
      return;
    }
    flushList(`l${idx}`);
    if (/^#{1,6}\s+/.test(line)) {
      const level = line.match(/^#+/)![0].length;
      const text = line.replace(/^#{1,6}\s+/, '');
      const Tag = `h${Math.min(level + 2, 6)}` as 'h3' | 'h4' | 'h5' | 'h6';
      out.push(
        <Tag key={idx} className="mt-3 mb-1 font-semibold text-slate-900" dangerouslySetInnerHTML={{ __html: inline(text) }} />,
      );
    } else if (line.trim() === '') {
      // 空行忽略
    } else if (/^\s*\d+\.\s+/.test(line)) {
      out.push(
        <p key={idx} className="my-1 text-slate-700" dangerouslySetInnerHTML={{ __html: inline(line.replace(/^\s*\d+\.\s+/, '')) }} />,
      );
    } else {
      out.push(<p key={idx} className="my-1 leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: inline(line) }} />);
    }
  });
  flushList('end');
  if (inCode && codeBuf.length) {
    out.push(
      <pre key="cend" className="my-2 overflow-auto rounded-lg bg-slate-900 p-3 text-[12px] leading-relaxed text-slate-100">
        <code>{codeBuf.join('\n')}</code>
      </pre>,
    );
  }
  return out;
}
