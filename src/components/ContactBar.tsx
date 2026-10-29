import type { PointerEvent } from 'react';
import { siFacebook, siGmail, siLinkedin, siTelegram, siViber, siWhatsapp, type SimpleIcon } from 'simple-icons';
import callIcon from '@/assets/icons/call.svg?raw';
import chatIcon from '@/assets/icons/chat.svg?raw';
import downloadIcon from '@/assets/icons/download.svg?raw';
import calendarIcon from '@/assets/icons/calendar_today.svg?raw';
import { contact, downloadBlob, vCardBlob } from '@/lib/contact';
import { PAGE_COUNT } from '@/components/FlyScene';

// Tile look: tile colour, glyph colour, and the glyph as SVG markup.
interface Tile {
  bg: string;
  fg: string;
  svg: string;
}

interface Item {
  label: string;
  short?: string; // label on phones, where space is tight
  tile: Tile;
  href?: string;
  onClick?: () => void;
}

const brand = (icon: SimpleIcon) =>
  `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="${icon.path}"/></svg>`;

// Real app logos (simple-icons, CC0). Logos that are their own shape sit on a white tile in brand colour,
// as their app icons do. Actions with no brand use phone-style system tiles.
const items: Item[] = [
  { label: 'Email', tile: { bg: '#ffffff', fg: `#${siGmail.hex}`, svg: brand(siGmail) }, href: `mailto:${contact.email}` },
  { label: 'Call', tile: { bg: '#34c759', fg: '#ffffff', svg: callIcon }, href: `tel:${contact.phone}` },
  { label: 'Text', tile: { bg: '#30d158', fg: '#ffffff', svg: chatIcon }, href: `sms:${contact.phone}` },
  { label: 'WhatsApp', tile: { bg: `#${siWhatsapp.hex}`, fg: '#ffffff', svg: brand(siWhatsapp) }, href: 'https://wa.me/639064109901' },
  { label: 'Viber', tile: { bg: `#${siViber.hex}`, fg: '#ffffff', svg: brand(siViber) }, href: 'viber://chat?number=%2B639064109901' },
  { label: 'Telegram', tile: { bg: '#ffffff', fg: `#${siTelegram.hex}`, svg: brand(siTelegram) }, href: 'https://t.me/+639064109901' },
  { label: 'LinkedIn', tile: { bg: '#ffffff', fg: `#${siLinkedin.hex}`, svg: brand(siLinkedin) }, href: 'https://www.linkedin.com/in/al-john-manalaysay-3b0127335/' },
  { label: 'Facebook', tile: { bg: '#ffffff', fg: `#${siFacebook.hex}`, svg: brand(siFacebook) }, href: 'https://www.facebook.com/share/1C9nqyLteE/' },
  {
    label: 'Save contact',
    short: 'Save',
    tile: { bg: '#0a84ff', fg: '#ffffff', svg: downloadIcon },
    onClick: () => downloadBlob(vCardBlob(), `${contact.displayName}.vcf`),
  },
  {
    // The booking page is the last page of the deck.
    label: 'Book',
    tile: { bg: '#ff453a', fg: '#ffffff', svg: calendarIcon },
    onClick: () => window.dispatchEvent(new CustomEvent('deck:goto', { detail: PAGE_COUNT - 1 })),
  },
];

// The tile tilts toward the pointer, so it reads as a raised 3D key.
function tilt(e: PointerEvent<HTMLElement>) {
  const el = e.currentTarget.querySelector<HTMLElement>('[data-tile]');
  if (!el) return;
  const r = e.currentTarget.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  el.style.transform = `perspective(240px) rotateX(${-y * 28}deg) rotateY(${x * 28}deg) translateZ(6px) scale(1.08)`;
}

function untilt(e: PointerEvent<HTMLElement>) {
  const el = e.currentTarget.querySelector<HTMLElement>('[data-tile]');
  if (el) el.style.transform = '';
}

function AppTile({ tile }: { tile: Tile }) {
  return (
    <span
      data-tile
      aria-hidden="true"
      className="relative flex h-8 w-8 min-w-0 max-w-full shrink items-center justify-center overflow-hidden rounded-[9px] transition-transform duration-200 ease-out [transform-style:preserve-3d] md:h-9 md:w-9 md:rounded-[10px]"
      style={{
        background: `linear-gradient(160deg, color-mix(in oklch, ${tile.bg} 82%, white) 0%, ${tile.bg} 45%, color-mix(in oklch, ${tile.bg} 78%, black) 100%)`,
        color: tile.fg,
        // Top edge highlight, bottom inner shade, a hard 2px base for depth, then a soft drop shadow.
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -2px 4px rgba(0,0,0,0.22), 0 2px 0 color-mix(in oklch, ${tile.bg} 55%, black), 0 6px 14px rgba(0,0,0,0.45)`,
      }}
    >
      <span
        className="h-[58%] w-[58%] [&>svg]:h-full [&>svg]:w-full [&>svg]:fill-current"
        style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.25))' }}
        dangerouslySetInnerHTML={{ __html: tile.svg }}
      />
      {/* Gloss: a soft light band across the top half. */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-white/0" />
    </span>
  );
}

// Floating glass bar with every contact action. Top centre; under the header row on phones.
export default function ContactBar() {
  const itemClass =
    'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-0 py-1 text-[#eaf4ff] transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#4fd8ff] md:h-12 md:flex-row md:gap-2 md:rounded-full md:px-2 md:py-0 xl:pr-3';
  // Phones: short label under the tile. Desktop: tiles only, full label from 1280px.
  const shortClass = 'sr-only md:hidden';
  const labelClass = 'hidden whitespace-nowrap text-xs xl:inline';

  return (
    <nav
      aria-label="Contact"
      className="fixed inset-x-2 top-14 z-50 flex justify-between gap-0 rounded-2xl border border-white/20 bg-white/[0.07] p-1 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-2xl backdrop-saturate-150 md:inset-x-auto md:left-1/2 md:top-3 md:flex md:max-w-[calc(100vw-1rem)] md:-translate-x-1/2 md:gap-1 md:rounded-full"
    >
      {items.map((it) => {
        const body = (
          <>
            <AppTile tile={it.tile} />
            <span className={shortClass}>{it.short ?? it.label}</span>
            <span className={labelClass}>{it.label}</span>
          </>
        );
        return it.href ? (
          <a
            key={it.label}
            href={it.href}
            target={it.href.startsWith('http') ? '_blank' : undefined}
            rel={it.href.startsWith('http') ? 'noopener' : undefined}
            aria-label={it.label}
            title={it.label}
            onPointerMove={tilt}
            onPointerLeave={untilt}
            className={itemClass}
          >
            {body}
          </a>
        ) : (
          <button
            key={it.label}
            type="button"
            onClick={it.onClick}
            aria-label={it.label}
            title={it.label}
            onPointerMove={tilt}
            onPointerLeave={untilt}
            className={itemClass}
          >
            {body}
          </button>
        );
      })}
    </nav>
  );
}
