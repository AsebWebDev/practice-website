export type InlineCodeFinding = {
  kind: 'script' | 'style element' | 'style attribute' | 'event handler';
  snippet: string;
};

const patterns: { kind: InlineCodeFinding['kind']; pattern: RegExp }[] = [
  // A script is inline when it has no src attribute. JSON data blocks are
  // not executed, so the Content-Security-Policy does not apply to them.
  {
    kind: 'script',
    pattern:
      /<script\b(?![^>]*\bsrc\s*=)(?![^>]*\btype\s*=\s*["']?application\/(?:ld\+)?json)[^>]*>/gi,
  },
  { kind: 'style element', pattern: /<style\b[^>]*>/gi },
  { kind: 'style attribute', pattern: /<[^>]*\sstyle\s*=[^>]*>/gi },
  { kind: 'event handler', pattern: /<[^>]*\son[a-z]+\s*=[^>]*>/gi },
];

/**
 * Lists everything in an HTML document that a Content-Security-Policy of
 * `default-src 'self'` would block.
 */
export function findInlineCode(html: string): InlineCodeFinding[] {
  return patterns.flatMap(({ kind, pattern }) =>
    [...html.matchAll(pattern)].map((match) => ({
      kind,
      snippet: match[0].slice(0, 120),
    })),
  );
}
