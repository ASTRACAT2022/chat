function renderInline(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  let remaining = text;

  while (remaining) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const codeMatch = remaining.match(/`(.+?)`/);
    const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/);

    const boldIdx = boldMatch ? remaining.indexOf(boldMatch[0]) : -1;
    const codeIdx = codeMatch ? remaining.indexOf(codeMatch[0]) : -1;
    const linkIdx = linkMatch ? remaining.indexOf(linkMatch[0]) : -1;

    const first = [boldIdx, codeIdx, linkIdx]
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);

    if (first.length === 0) {
      parts.push(remaining);
      break;
    }

    const pos = first[0];
    if (pos > 0) {
      parts.push(remaining.slice(0, pos));
      remaining = remaining.slice(pos);
      continue;
    }

    if (boldIdx === 0 && boldMatch) {
      parts.push(<strong key={parts.length} className="font-bold text-gray-200">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
    } else if (codeIdx === 0 && codeMatch) {
      parts.push(<code key={parts.length} className="text-xs sm:text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded-md font-mono text-accent-light">{codeMatch[1]}</code>);
      remaining = remaining.slice(codeMatch[0].length);
    } else if (linkIdx === 0 && linkMatch) {
      parts.push(<a key={parts.length} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-accent-light hover:underline">{linkMatch[1]}</a>);
      remaining = remaining.slice(linkMatch[0].length);
    } else {
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    }
  }

  return parts;
}

function parseTable(lines: string[]): { head: string[]; rows: string[][] } | null {
  if (lines.length < 2) return null;
  const headerLine = lines[0].trim();
  if (!headerLine.startsWith('|') || !headerLine.endsWith('|')) return null;

  const separator = lines[1].trim();
  if (!/^\|[-:\s|]+\|$/.test(separator)) return null;

  const head = headerLine
    .split('|')
    .filter((_, i, arr) => i > 0 && i < arr.length - 1)
    .map((s) => s.trim());

  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|') || !line.endsWith('|')) break;
    const cells = line
      .split('|')
      .filter((_, j, arr) => j > 0 && j < arr.length - 1)
      .map((s) => s.trim());
    if (cells.length > 0) rows.push(cells);
  }

  if (head.length === 0) return null;
  return { head, rows };
}

interface Props {
  content: string;
}

export default function MarkdownRenderer({ content }: Props) {
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={`e${i}`} className="h-2" />);
      i++;
      continue;
    }

    // Table detection
    if (line.trim().startsWith('|')) {
      const tableData = parseTable(lines.slice(i));
      if (tableData) {
        const { head, rows } = tableData;
        elements.push(
          <div key={`e${i}`} className="overflow-x-auto my-3">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  {head.map((h, idx) => (
                    <th key={idx} className="px-3 py-2 text-left font-semibold text-gray-300 bg-white/[0.03] first:rounded-l-lg last:rounded-r-lg whitespace-nowrap">
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-gray-400">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        i += 1 + 1 + rows.length; // header + separator + rows
        continue;
      }
    }

    // Code block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre key={`e${i}`} className="my-3 text-xs sm:text-[11px] bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 font-mono text-gray-400 leading-relaxed overflow-x-auto whitespace-pre-wrap">
          {codeLines.join('\n')}
        </pre>,
      );
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*+]\s/, ''));
        i++;
      }
      elements.push(
        <ul key={`e${i}`} className="my-2 space-y-1 list-disc list-inside text-sm text-gray-300">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+[.)]\s/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s/, ''));
        i++;
      }
      elements.push(
        <ol key={`e${i}`} className="my-2 space-y-1 list-decimal list-inside text-sm text-gray-300">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Heading
    const headingMatch = line.trim().match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const Tag = ['h1', 'h2', 'h3'][level - 1] as 'h1' | 'h2' | 'h3';
      const sizeClass = level === 1 ? 'text-base font-bold text-gray-200 my-3' : level === 2 ? 'text-sm font-bold text-gray-300 my-2' : 'text-xs font-semibold text-gray-300 my-2';
      elements.push(
        <Tag key={`e${i}`} className={sizeClass}>{renderInline(headingMatch[2])}</Tag>,
      );
      i++;
      continue;
    }

    // Regular paragraph
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].trim().startsWith('|') && !lines[i].trim().startsWith('```') && !/^[-*+#]/.test(lines[i].trim()) && !/^\d+[.)]\s/.test(lines[i].trim())) {
      paraLines.push(lines[i]);
      i++;
    }
    elements.push(
      <p key={`e${i}`} className="text-sm leading-relaxed text-gray-300 my-1.5">
        {paraLines.map((para, idx) => (
          <span key={idx}>{renderInline(para)}{idx < paraLines.length - 1 && <br />}</span>
        ))}
      </p>,
    );
  }

  return <div className="space-y-0.5">{elements}</div>;
}
