// ============================================================================
// Compartir artículo — enlaces directos a las URLs de share de cada red.
// Sin SDKs ni scripts de terceros. navigator.share() solo como mejora
// progresiva (si el navegador lo soporta) y "copiar enlace" con fallback.
// ============================================================================
import React, { useState } from 'react';
import { Check, Copy, Facebook, Linkedin, MessageCircle, Share2 } from 'lucide-react';

interface ShareArticleProps {
  /** URL absoluta y canonical del artículo. */
  url: string;
  title: string;
}

// X no tiene icono oficial en lucide; se usa la marca (simple-icons, CC0).
const XBrandIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
  </svg>
);

const shareButtonClass =
  'inline-flex items-center justify-center w-10 h-10 rounded-full border border-zinc-800 ' +
  'text-zinc-400 hover:text-amber-400 hover:border-amber-400/50 transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400';

export const ShareArticle: React.FC<ShareArticleProps> = ({ url, title }) => {
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const links: Array<{
    label: string;
    href: string;
    Icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      label: 'Compartir en WhatsApp',
      href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
      Icon: MessageCircle,
    },
    {
      label: 'Compartir en Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      Icon: Facebook,
    },
    {
      label: 'Compartir en LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      Icon: Linkedin,
    },
    {
      label: 'Compartir en X',
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodeURIComponent(title)}`,
      Icon: XBrandIcon,
    },
  ];

  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title, text: title, url });
    } catch {
      // El usuario canceló el diálogo nativo; no es un error.
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback para navegadores sin Clipboard API (contexto no seguro).
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section aria-label="Compartir artículo" className="mt-12 border-t border-zinc-800 pt-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-zinc-400">Compartir artículo:</span>
        {links.map(({ label, href, Icon }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            title={label}
            className={shareButtonClass}
          >
            <Icon className="w-4 h-4" />
          </a>
        ))}
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copiar enlace del artículo"
          title="Copiar enlace"
          className={shareButtonClass}
        >
          {copied ? <Check className="w-4 h-4 text-amber-400" /> : <Copy className="w-4 h-4" />}
        </button>
        {canNativeShare && (
          <button
            type="button"
            onClick={handleNativeShare}
            aria-label="Compartir con el menú del dispositivo"
            title="Compartir…"
            className={shareButtonClass}
          >
            <Share2 className="w-4 h-4" />
          </button>
        )}
        <span aria-live="polite" className="text-sm text-amber-400">
          {copied ? '¡Enlace copiado!' : ''}
        </span>
      </div>
    </section>
  );
};
