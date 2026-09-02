import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Zap } from 'lucide-react';

export type ConversationThreadMessage = {
  id?: string
  content?: string
  answer?: string
  role?: string
  created_at?: string
  reply_to_message_id?: string
  reply_preview?: string
  is_followup_dinamico?: boolean
}

export const toTimestamp = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber) && Number.isFinite(asNumber)) return asNumber;
    const isoish = value.includes(' ') && !value.includes('T') ? value.replace(' ', 'T') : value;
    const parsed = Date.parse(isoish);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

export const parseTimestampzToDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (typeof value !== 'string') return null;
  let s = value.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (!Number.isNaN(n) && Number.isFinite(n)) return new Date(n);
  }
  if (s.includes(' ') && !s.includes('T')) s = s.replace(' ', 'T');
  s = s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  s = s.replace(/([+-]\d{2})$/, '$1:00');
  const parsed = Date.parse(s);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed);
};

export const normalizeMessageId = (id: string) => {
  if (!id) return id;
  if (id.endsWith('-q') || id.endsWith('-a')) return id.slice(0, -2);
  return id;
};

export const stripAiThinking = (input: string) => {
  let out = (input ?? '').toString();
  const stripTag = (tag: string) => {
    out = out.replace(new RegExp(`<\\s*${tag}\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*${tag}\\s*>`, 'gi'), '');
    out = out.replace(new RegExp(`<\\s*${tag}\\b[^>]*>[\\s\\S]*$`, 'gi'), '');
    out = out.replace(new RegExp(`&lt;\\s*${tag}\\b[^&]*&gt;[\\s\\S]*?(?:&lt;\\s*\\/\\s*${tag}\\s*&gt;|$)`, 'gi'), '');
  };
  stripTag('think');
  stripTag('thinking');
  out = out.replace(/<\s*\/\s*(think|thinking)\s*>/gi, '');
  out = out.replace(/<\s*(think|thinking)\b[^>]*>/gi, '');
  out = out.replace(/&lt;\s*\/\s*(think|thinking)\s*&gt;/gi, '');
  out = out.replace(/&lt;\s*(think|thinking)\b[^&]*&gt;/gi, '');
  out = out.replace(/^\s*(think|thinking)\s*:\s*[\s\S]*?(?=\n\s*\n|$)/gim, '');
  return out.trim();
};

export const formatMessage = (s: string) => {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const renderWithLinks = (text: string, keyPrefix: string) => {
    const out: (string | JSX.Element)[] = [];
    let last = 0;
    let i = 0;
    let m: RegExpExecArray | null;
    while ((m = urlRegex.exec(text)) !== null) {
      const start = m.index;
      const end = urlRegex.lastIndex;
      if (start > last) out.push(text.slice(last, start));
      const raw = m[0];
      const href = raw.startsWith('http') ? raw : `https://${raw}`;
      out.push(
        <a
          key={`${keyPrefix}-lnk-${i}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline opacity-90 hover:opacity-100 break-all"
        >
          {raw}
        </a>
      );
      last = end;
      i++;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  };

  const pieces: (string | JSX.Element)[] = [];
  const boldRegex = /\*(.+?)\*/g;
  let lastIndex = 0;
  let idx = 0;
  let m: RegExpExecArray | null;
  while ((m = boldRegex.exec(s)) !== null) {
    const start = m.index;
    const end = boldRegex.lastIndex;
    if (start > lastIndex) pieces.push(...renderWithLinks(s.slice(lastIndex, start), `pre-${idx}`));
    pieces.push(
      <span key={`fmt-${idx}`} className="font-semibold opacity-90">
        {renderWithLinks(m[1], `bold-${idx}`)}
      </span>
    );
    lastIndex = end;
    idx++;
  }
  if (lastIndex < s.length) pieces.push(...renderWithLinks(s.slice(lastIndex), `post-${idx}`));
  return pieces;
};

type MessageRenderBlock =
  | { type: 'text'; content: string }
  | { type: 'image'; url: string; alt: string; caption?: string }
  | { type: 'pdf'; url: string; fileName: string; caption?: string };

const ImageAttachmentCard = ({ url, alt, caption }: { url: string; alt: string; caption?: string }) => {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  const frameStyle = useMemo<React.CSSProperties>(() => {
    if (!dimensions?.width || !dimensions?.height) {
      return { width: '18rem', aspectRatio: '1 / 1', maxWidth: '100%' };
    }

    const ratio = dimensions.width / dimensions.height;
    if (ratio >= 1.15) {
      return { width: '18rem', aspectRatio: `${dimensions.width} / ${dimensions.height}`, maxWidth: '100%' };
    }
    if (ratio <= 0.9) {
      return { width: '14rem', aspectRatio: `${dimensions.width} / ${dimensions.height}`, maxWidth: '100%' };
    }
    return { width: '18rem', aspectRatio: '1 / 1', maxWidth: '100%' };
  }, [dimensions]);

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      <div
        className="overflow-hidden rounded-2xl border border-black/10 bg-white/70"
        style={frameStyle}
      >
        <img
          src={url}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          onLoad={(event) => {
            const img = event.currentTarget;
            const width = Number(img.naturalWidth || 0);
            const height = Number(img.naturalHeight || 0);
            if (width > 0 && height > 0) {
              setDimensions({ width, height });
            }
          }}
        />
      </div>
      {!!caption && (
        <div className="mt-2 whitespace-pre-line text-sm text-black">
          {formatMessage(caption)}
        </div>
      )}
    </a>
  );
};

const PdfAttachmentCard = ({ url, caption }: { url: string; caption?: string }) => {
  const metaLabel = 'PDF';

  return (
    <div className="w-72 max-w-full overflow-hidden rounded-2xl border border-black/10 bg-white/70">
      <div className="h-36 w-full bg-white relative">
        <div className="absolute inset-0 p-4">
          <div className="space-y-2 blur-sm opacity-70">
            <div className="h-3 w-11/12 rounded bg-black/10" />
            <div className="h-3 w-10/12 rounded bg-black/10" />
            <div className="h-3 w-8/12 rounded bg-black/10" />
            <div className="h-3 w-9/12 rounded bg-black/10" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 bg-emerald-900 px-3 py-3 text-white">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600 text-xs font-extrabold">PDF</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">arquivo</div>
          <div className="mt-0.5 text-xs text-white/80">{metaLabel}</div>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-xs font-semibold"
        >
          <FileText className="h-4 w-4" />
          Visualizar
        </a>
      </div>
      {!!caption && (
        <div className="px-3 py-2 whitespace-pre-line text-sm text-black">{formatMessage(caption)}</div>
      )}
    </div>
  );
};

const getAttachmentFileName = (url: string, fallback: string) => {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname || '';
    const raw = pathname.split('/').filter(Boolean).pop() || fallback;
    return decodeURIComponent(raw);
  } catch {
    const raw = String(url || '').split('/').filter(Boolean).pop() || fallback;
    return raw;
  }
};

export const getMessageRenderBlocks = (input: string): MessageRenderBlock[] => {
  const text = String(input || '');
  const lines = text.split('\n');
  const blocks: MessageRenderBlock[] = [];
  let lastAttachmentIndex = -1;
  let textBuffer: string[] = [];
  let skippingAttachmentDescription = false;

  const imageHeader = /^Descrição da imagem enviado pelo lead\s*\(Link:\s*`?(https?:\/\/[^\s)`]+)[^)]*\)\s*:?.*$/i;
  const pdfHeader = /^Descrição do Arquivo enviado pelo cliente\s*\(Link:\s*`?(https?:\/\/[^\s)`]+)[^)]*\)\s*:?.*$/i;
  const legendHeader = /^Legenda\s*:\s*(.*)$/i;
  const flushTextBuffer = () => {
    const content = textBuffer.join('\n').trim();
    textBuffer = [];
    if (content) blocks.push({ type: 'text', content });
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = String(lines[i] ?? '');
    const trimmed = rawLine.trim();

    if (skippingAttachmentDescription) {
      if (!trimmed) {
        skippingAttachmentDescription = false;
        continue;
      }
      if (trimmed.match(legendHeader) || trimmed.match(imageHeader) || trimmed.match(pdfHeader)) {
        skippingAttachmentDescription = false;
      } else {
        continue;
      }
    }

    const imgMatch = trimmed.match(imageHeader);
    if (imgMatch) {
      const url = String(imgMatch[1] || '').trim();
      if (url) {
        flushTextBuffer();
        blocks.push({ type: 'image', url, alt: 'Imagem enviada pelo lead' });
        lastAttachmentIndex = blocks.length - 1;
        skippingAttachmentDescription = true;
      }
      continue;
    }

    const pdfMatch = trimmed.match(pdfHeader);
    if (pdfMatch) {
      const url = String(pdfMatch[1] || '').trim();
      if (url) {
        flushTextBuffer();
        blocks.push({ type: 'pdf', url, fileName: getAttachmentFileName(url, 'arquivo.pdf') });
        lastAttachmentIndex = blocks.length - 1;
        skippingAttachmentDescription = true;
      }
      continue;
    }

    const legendMatch = trimmed.match(legendHeader);
    if (legendMatch && lastAttachmentIndex >= 0) {
      const captionLines: string[] = [];
      const first = String(legendMatch[1] || '').trim();
      if (first) captionLines.push(first);

      let j = i + 1;
      while (j < lines.length) {
        const nextRaw = String(lines[j] ?? '');
        const nextTrimmed = nextRaw.trim();
        if (!nextTrimmed) {
          j++;
          break;
        }
        if (nextTrimmed.match(imageHeader) || nextTrimmed.match(pdfHeader) || nextTrimmed.match(legendHeader)) break;
        captionLines.push(nextRaw);
        j++;
      }

      const caption = captionLines.join('\n').trim();
      if (caption) {
        const block = blocks[lastAttachmentIndex];
        if (block.type === 'image') block.caption = caption;
        if (block.type === 'pdf') block.caption = caption;
      }
      i = j - 1;
      continue;
    }

    textBuffer.push(rawLine);
  }

  flushTextBuffer();

  if (blocks.length > 0) return blocks;

  return [{ type: 'text', content: text }];
};

export const formatMessageTime = (value: unknown) => {
  if (typeof value === 'number') return '';
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return '';
  const d = parseTimestampzToDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d);
};

export const getMessageLocalDayKey = (value: unknown) => {
  if (typeof value === 'number') return null;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return null;
  const d = parseTimestampzToDate(value);
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatConversationDaySeparator = (value: unknown) => {
  if (typeof value === 'number') return '';
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return '';
  const d = parseTimestampzToDate(value);
  if (!d) return '';
  const now = new Date();
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startD = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.floor((startNow - startD) / 86400000);
  const days = Math.max(0, diffDays);

  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days >= 2 && days <= 6) {
    const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(d);
    return weekday ? weekday.charAt(0).toUpperCase() + weekday.slice(1) : '';
  }
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(d);
};

export const parseLeadsV2Conversa = (leadId: string, conversaRaw: string, baseTimestamp: number): ConversationThreadMessage[] => {
  const lines = String(conversaRaw || '').split('\n');
  let currentRole: 'assistant' | 'user' | null = null;
  let currentExternalId: string | null = null;
  let currentCreatedAt: string | null = null;
  let currentIsFollowUpDinamico: boolean = false;
  let buffer: string[] = [];
  const out: ConversationThreadMessage[] = [];

  const normalizeBaseId = (id: string) => {
    const s = String(id || '').trim();
    if (s.endsWith('-q') || s.endsWith('-a')) return s.slice(0, -2);
    return s;
  };

  const push = () => {
    if (!currentRole) return;
    const text = buffer.join('\n').trim();
    if (!text) return;
    const idx = out.length;
    const idBase = currentExternalId ? normalizeBaseId(currentExternalId) : `${leadId}-${idx}`;
    out.push({
      id: `${idBase}${currentRole === 'assistant' ? '-a' : '-q'}`,
      role: currentRole,
      content: text,
      created_at: currentCreatedAt ? currentCreatedAt : String(baseTimestamp + idx),
      is_followup_dinamico: currentIsFollowUpDinamico || undefined,
    });
  };

  const headerFullRegex = /^(IA|CLIENTE)\s*(?:\(\s*[^)]*\s*\)\s*)*:\s*/i;
  const extractMessageId = (header: string) => {
    const m = header.match(/\(\s*messageId\s*:\s*([^)]+)\s*\)/i);
    return m ? String(m[1]).trim() : null;
  };
  const extractTimestampz = (header: string) => {
    const m = header.match(/\(\s*timestampz\s*:\s*([^)]+)\s*\)/i);
    return m ? String(m[1]).trim() : null;
  };
  const extractIsFollowUpDinamico = (header: string) => {
    return /\(\s*FollowUp\s*Dinâmico\s*\)/i.test(header);
  };

  for (const rawLine of lines) {
    const line = String(rawLine ?? '').replace(/\r$/, '');
    const trimmed = line.trimStart();

    const fullMatch = trimmed.match(headerFullRegex);
    if (fullMatch) {
      const headerPart = String(fullMatch[0] ?? '');
      const roleTag = String(fullMatch[1] ?? '').toUpperCase();
      const colonIdx = headerPart.lastIndexOf(':');
      if (colonIdx >= 0 && (roleTag === 'IA' || roleTag === 'CLIENTE')) {
        const header = headerPart.slice(0, colonIdx);
        const firstContentLine = trimmed.slice(headerPart.length);
        push();
        currentRole = roleTag === 'IA' ? 'assistant' : 'user';
        currentExternalId = extractMessageId(header);
        currentCreatedAt = extractTimestampz(header);
        currentIsFollowUpDinamico = extractIsFollowUpDinamico(header);
        buffer = [firstContentLine];
        continue;
      }
    }

    if (!currentRole) continue;
    buffer.push(line);
  }
  push();

  const stripSuffix = (id: string) => {
    const s = String(id || '').trim();
    if (s.endsWith('-q') || s.endsWith('-a')) return s.slice(0, -2);
    return s;
  };

  const assistantById = new Map<string, string>();
  out.forEach((m) => {
    const role = String(m?.role || '');
    if (role !== 'assistant' && role !== 'bot') return;
    const base = normalizeBaseId(stripSuffix(String(m?.id || '')));
    if (!base) return;
    assistantById.set(base, String(m?.content || m?.answer || ''));
  });

  const replyRegexOld = /^Cliente respondeu a mensagem da IA\s*\(([^)]+)\)\s*com\s*["“]([\s\S]*?)["”]\s*$/i;
  const replyRegexNew = /^Cliente respondeu a mensagem da IA\s*\(([\s\S]*?)\)\s*com\s*:?\s*([\s\S]*)$/i;
  const embeddedHeaderRegex = /^Cliente respondeu a mensagem da IA\s*\(([\s\S]*?)\)\s*com\s*:?\s*(.*)$/i;
  const resolveReplyPreview = (mentionedRaw: string) => {
    const mentioned = String(mentionedRaw || '').trim();
    if (!mentioned) return '';
    const normalized = normalizeBaseId(mentioned);
    return String(assistantById.get(normalized) || mentioned);
  };
  const buildDerivedMessage = (base: ConversationThreadMessage, index: number, overrides: Partial<ConversationThreadMessage>) => {
    const baseId = normalizeBaseId(stripSuffix(String(base?.id || 'msg')));
    const baseCreatedAt = String(base?.created_at || '');
    const derivedCreatedAt =
      index === 0
        ? baseCreatedAt
        : String((toTimestamp(baseCreatedAt) || baseTimestamp) + index);
    return {
      ...base,
      id: `${baseId}-split-${index}-q`,
      created_at: derivedCreatedAt,
      is_followup_dinamico: base?.is_followup_dinamico,
      ...overrides,
    };
  };
  const splitUserReplyBlocks = (message: ConversationThreadMessage) => {
    if (String(message?.role || '') !== 'user') return [message];
    const original = String(message?.content || '');
    const matchOld = original.match(replyRegexOld);
    if (matchOld) {
      const referencedId = normalizeBaseId(String(matchOld[1] || '').trim());
      const newText = String(matchOld[2] || '').trim();
      const referencedText = referencedId ? (assistantById.get(referencedId) || referencedId) : undefined;
      return [
        {
          ...message,
          reply_to_message_id: referencedId || undefined,
          reply_preview: referencedText ? String(referencedText) : undefined,
          content: newText,
        },
      ];
    }

    const lines = original.split('\n');
    const derived: ConversationThreadMessage[] = [];
    let pendingPlain: string[] = [];
    let hasReplyHeaders = false;

    const pushPlain = () => {
      const content = pendingPlain.join('\n').trim();
      pendingPlain = [];
      if (!content) return;
      derived.push(buildDerivedMessage(message, derived.length, {
        content,
        reply_preview: undefined,
        reply_to_message_id: undefined,
      }));
    };

    const normalizeQuotedFirstLine = (input: string) => {
      const raw = String(input || '');
      const trimmed = raw.trim();
      const quoted = trimmed.match(/^["“]([\s\S]*?)["”]\s*(.*)$/);
      if (!quoted) return trimmed;
      return [String(quoted[1] || '').trim(), String(quoted[2] || '').trim()].filter(Boolean).join('\n').trim();
    };

    for (let i = 0; i < lines.length; i++) {
      const currentLine = String(lines[i] ?? '');
      const headerMatch = currentLine.trim().match(embeddedHeaderRegex);
      if (!headerMatch) {
        pendingPlain.push(currentLine);
        continue;
      }

      hasReplyHeaders = true;
      pushPlain();

      const mentionedRaw = String(headerMatch[1] || '').trim();
      const firstPayload = String(headerMatch[2] || '');
      const responseLines: string[] = [];
      if (firstPayload.trim()) responseLines.push(firstPayload);

      let j = i + 1;
      while (j < lines.length) {
        const candidateLine = String(lines[j] ?? '');
        if (candidateLine.trim().match(embeddedHeaderRegex)) break;
        responseLines.push(candidateLine);
        j++;
      }

      const firstNonEmptyIndex = responseLines.findIndex((line) => String(line || '').trim().length > 0);
      if (firstNonEmptyIndex >= 0) {
        responseLines[firstNonEmptyIndex] = normalizeQuotedFirstLine(responseLines[firstNonEmptyIndex]);
      }
      const responseText = responseLines.join('\n').trim();
      derived.push(buildDerivedMessage(message, derived.length, {
        content: responseText || '',
        reply_preview: resolveReplyPreview(mentionedRaw) || undefined,
        reply_to_message_id: undefined,
      }));
      i = j - 1;
    }

    pushPlain();

    if (hasReplyHeaders && derived.length > 0) {
      return derived.filter((item) => String(item?.content || '').trim() || String(item?.reply_preview || '').trim());
    }

    const matchNew = original.match(replyRegexNew);
    if (matchNew) {
      const mentionedText = String(matchNew[1] || '').trim();
      const rest = String(matchNew[2] || '').trim();
      const quoted = rest.match(/["“]([\s\S]*?)["”]/);
      const mainText = String((quoted ? quoted[1] : rest) || '').trim();
      const tailText =
        quoted && typeof (quoted as any).index === 'number'
          ? String(rest.slice(((quoted as any).index as number) + String(quoted[0] || '').length) || '').trim()
          : '';
      const combinedText = [mainText, tailText].filter(Boolean).join('\n').trim();
      if (mentionedText && combinedText) {
        return [
          {
            ...message,
            reply_to_message_id: undefined,
            reply_preview: resolveReplyPreview(mentionedText) || mentionedText,
            content: combinedText,
          },
        ];
      }
    }

    return [message];
  };

  return out.flatMap(splitUserReplyBlocks);
};

type ConversationThreadProps = {
  messages: ConversationThreadMessage[]
  containerRef?: React.RefObject<HTMLDivElement | null>
  className?: string
  style?: React.CSSProperties
  emptyState?: React.ReactNode
  assistantActions?: (message: ConversationThreadMessage, baseId: string, index: number) => React.ReactNode
  afterMessages?: React.ReactNode
}

export const ConversationThread = ({
  messages,
  containerRef,
  className,
  style,
  emptyState,
  assistantActions,
  afterMessages,
}: ConversationThreadProps) => {
  const internalRef = useRef<HTMLDivElement | null>(null);
  const ref = containerRef || internalRef;
  const [stickyDayLabel, setStickyDayLabel] = useState('');

  const ordered = useMemo(() => {
    return [...(messages || [])];
  }, [messages]);

  const updateStickyDayFromScroll = () => {
    const container = ref.current;
    if (!container) return;
    const nodes = Array.from(container.querySelectorAll<HTMLElement>('[data-msg-day-key]'));
    if (nodes.length === 0) {
      setStickyDayLabel('');
      return;
    }
    const containerTop = container.getBoundingClientRect().top;
    const threshold = 12;
    let activeCreatedAt = '';

    for (const node of nodes) {
      const dayKey = node.getAttribute('data-msg-day-key') || '';
      if (!dayKey) continue;
      const topRel = node.getBoundingClientRect().top - containerTop;
      if (topRel <= threshold) {
        activeCreatedAt = node.getAttribute('data-msg-created-at') || '';
        continue;
      }
      break;
    }

    if (!activeCreatedAt) {
      for (const node of nodes) {
        const dayKey = node.getAttribute('data-msg-day-key') || '';
        if (!dayKey) continue;
        activeCreatedAt = node.getAttribute('data-msg-created-at') || '';
        break;
      }
    }

    const nextLabel = activeCreatedAt ? formatConversationDaySeparator(activeCreatedAt) : '';
    setStickyDayLabel(nextLabel);
  };

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        updateStickyDayFromScroll();
      });
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      container.removeEventListener('scroll', onScroll as any);
    };
  }, [ref, ordered.length]);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const raf = window.requestAnimationFrame(() => updateStickyDayFromScroll());
    return () => window.cancelAnimationFrame(raf);
  }, [ordered.length]);

  return (
    <div ref={ref} className={className} style={style}>
      {ordered.length === 0 ? (
        emptyState || null
      ) : (
        <>
          {!!stickyDayLabel && (
            <div className="sticky top-2 z-10 flex justify-center pointer-events-none">
              <div className="rounded-full bg-background/80 px-3 py-1 text-xs font-semibold text-black shadow-sm ring-1 ring-border/60">
                {stickyDayLabel}
              </div>
            </div>
          )}
          <div className="space-y-2.5">
            {ordered.map((m, idx, arr) => {
              const isAssistant = m.role === 'assistant' || m.role === 'bot';
              const isFollowUpDinamico = Boolean(m.is_followup_dinamico);
              const text = stripAiThinking(((m.content || m.answer || '') as string) || '');
              const contentBlocks = getMessageRenderBlocks(text);
              const replyPreview = !isAssistant ? stripAiThinking(String((m as any)?.reply_preview || '')) : '';
              const timeLabel = formatMessageTime(m.created_at);
              const dayKey = getMessageLocalDayKey(m.created_at);
              let prevKnownDayKey: string | null = null;
              for (let prevIdx = idx - 1; prevIdx >= 0; prevIdx--) {
                const candidate = getMessageLocalDayKey(arr[prevIdx]?.created_at);
                if (candidate) {
                  prevKnownDayKey = candidate;
                  break;
                }
              }
              const showDaySeparator = !!dayKey && prevKnownDayKey !== dayKey;
              const daySeparatorLabel = showDaySeparator ? formatConversationDaySeparator(m.created_at) : '';
              const baseId = normalizeMessageId(String(m.id || idx));
              const assistantActionsNode = isAssistant && assistantActions ? assistantActions(m, baseId, idx) : null;

              const followupBorderClasses = isFollowUpDinamico
                ? isAssistant
                  ? 'border-2 border-amber-500/80 ring-2 ring-amber-400/40 shadow-[0_0_0_1px_rgba(245,158,11,0.3),0_4px_12px_rgba(245,158,11,0.18)]'
                  : 'border-2 border-amber-500/70 ring-2 ring-amber-400/35 shadow-[0_0_0_1px_rgba(245,158,11,0.25),0_4px_12px_rgba(245,158,11,0.12)]'
                : '';

              return (
                <div
                  key={(m.id || idx).toString()}
                  className="space-y-0.5"
                  data-msg-day-key={dayKey || ''}
                  data-msg-created-at={typeof m.created_at === 'string' ? m.created_at : ''}
                >
                  {!!showDaySeparator && !!daySeparatorLabel && (
                    <div className="my-3 flex justify-center">
                      <div className="rounded-full bg-background/80 px-3 py-1 text-xs font-semibold text-black shadow-sm ring-1 ring-border/60">
                        {daySeparatorLabel}
                      </div>
                    </div>
                  )}
                  <div className={`flex ${isAssistant ? 'justify-end' : 'justify-start'} ${isFollowUpDinamico ? 'relative' : ''}`}>
                    {isFollowUpDinamico && (
                      <div
                        className={`absolute ${isAssistant ? '-top-2.5 right-2' : '-top-2.5 left-2'} z-10 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 text-white text-[10px] font-extrabold px-2 py-0.5 shadow-md ring-1 ring-black/10`}
                      >
                        <Zap className="h-3 w-3 drop-shadow-sm" strokeWidth={2.5} />
                        <span className="tracking-wide">FollowUp Dinâmico</span>
                      </div>
                    )}
                    <div
                      className={`relative whitespace-pre-line rounded-3xl px-4 py-2 text-sm shadow-sm ${followupBorderClasses} ${isAssistant ? 'max-w-[86%] bg-[#EBF57D] text-black md:max-w-[72%]' : 'max-w-[86%] bg-white/90 text-black md:max-w-[72%]'} ${isFollowUpDinamico ? 'mt-1.5' : ''}`}
                    >
                      {!!replyPreview && (
                        <div className="mb-2 rounded-2xl bg-black/5 px-3 py-2 text-xs text-black/70">
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 h-6 w-1 rounded-full bg-black/20" />
                            <div className="whitespace-pre-line">{formatMessage(replyPreview)}</div>
                          </div>
                        </div>
                      )}
                      <div className="space-y-2">
                        {contentBlocks.map((block, blockIdx) => {
                          if (block.type === 'image') {
                            return (
                              <ImageAttachmentCard
                                key={`msg-img-${blockIdx}`}
                                url={block.url}
                                alt={block.alt}
                                caption={block.caption}
                              />
                            );
                          }

                          if (block.type === 'pdf') {
                            return (
                              <PdfAttachmentCard
                                key={`msg-pdf-${blockIdx}`}
                                url={block.url}
                                caption={block.caption}
                              />
                            );
                          }

                          return (
                            <div key={`msg-txt-${blockIdx}`}>
                              {formatMessage(block.content)}
                            </div>
                          );
                        })}
                      </div>
                      {!!timeLabel && (
                        <div className="mt-1 flex justify-end text-[10px] font-medium text-black/60">
                          {timeLabel}
                        </div>
                      )}
                    </div>
                  </div>
                  {assistantActionsNode}
                </div>
              );
            })}
            {afterMessages}
          </div>
        </>
      )}
    </div>
  );
};
