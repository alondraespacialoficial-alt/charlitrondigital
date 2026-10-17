// Mini-renderizador "markdown-lite" compartido entre el navegador y el
// script de prerender (Node). Sin dependencias y SEGURO por construcción:
// TODO el texto se escapa antes de aplicar formato, por lo que no hay XSS.
//
// Sintaxis soportada:
//   ## Título / ### Subtítulo
//   - item (listas)
//   **negrita**, *cursiva*, [texto](https://url)
//   Párrafos separados por línea en blanco.

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-amber-400 underline underline-offset-4 hover:text-amber-300">$1</a>',
    );
}

export function renderMarkdownLite(source: string): string {
  const lines = escapeHtml(source ?? '').split(/\r?\n/);
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      html.push(`<p class="mb-5 leading-relaxed text-zinc-300">${renderInline(paragraph.join('<br />'))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      html.push(
        `<ul class="mb-6 list-disc space-y-2 pl-6 text-zinc-300">${list
          .map((item) => `<li>${renderInline(item)}</li>`)
          .join('')}</ul>`,
      );
      list = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.trim() === '') {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith('### ')) {
      flushParagraph();
      flushList();
      html.push(`<h3 class="mt-8 mb-3 text-xl font-bold text-white">${renderInline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      html.push(`<h2 class="mt-10 mb-4 text-2xl font-bold text-white">${renderInline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('- ')) {
      flushParagraph();
      list.push(line.slice(2));
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return html.join('\n');
}
