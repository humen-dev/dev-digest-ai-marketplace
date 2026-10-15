import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Guard: user-visible text lives in src/i18n/en.ts, not in components or pages.
// Parses every .tsx file under components/ and pages/ and reports JSX text,
// string literals rendered as JSX children, and string literals in text
// attributes that contain a letter. Separators such as "·", "/" and "—" have
// no letters and pass.

const SRC = join(import.meta.dirname, '..');
const DIRS = ['components', 'pages'];
const TEXT_ATTRS = new Set(['aria-label', 'title', 'placeholder', 'alt', 'aria-description', 'aria-placeholder']);
const LETTER = /\p{L}/u;

/** `file:text` pairs that are allowed to stay hardcoded. Keep this short. */
const ALLOW = new Set<string>([]);

function tsxFiles(): string[] {
  return DIRS.flatMap((d) =>
    (readdirSync(join(SRC, d), { recursive: true }) as string[])
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => join(SRC, d, f)),
  );
}

/** Text of a string-ish literal, or null when the node is not a literal. */
function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' ');
  return null;
}

function findings(file: string): string[] {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const rel = relative(SRC, file).replaceAll('\\', '/');
  const out: string[] = [];
  const report = (node: ts.Node, text: string) => {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!LETTER.test(clean) || ALLOW.has(`${rel}:${clean}`)) return;
    const { line } = src.getLineAndCharacterOfPosition(node.getStart(src));
    out.push(`${rel}:${line + 1}: ${JSON.stringify(clean)}`);
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      report(node, node.text);
    } else if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      const text = literalText(node.expression);
      if (text !== null) report(node, text);
    } else if (ts.isJsxAttribute(node) && TEXT_ATTRS.has(node.name.getText(src)) && node.initializer) {
      const init = node.initializer;
      const text = ts.isJsxExpression(init) ? (init.expression ? literalText(init.expression) : null) : literalText(init);
      if (text !== null) report(node, text);
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return out;
}

describe('translations', () => {
  it('finds the component and page files', () => {
    expect(tsxFiles().length).toBeGreaterThan(3);
  });

  it('has no hardcoded user-visible text in components or pages (use src/i18n/en.ts)', () => {
    expect(tsxFiles().flatMap(findings)).toEqual([]);
  });
});
