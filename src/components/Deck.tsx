import { useEffect, useRef, type ReactNode } from 'react';

interface DeckProps {
  pages: ReactNode[];
  onIndex: (index: number) => void;
}

const SCROLL_MS = 450; // custom page scroll: faster and more decisive than the browser's smooth scroll
const LEAVE_MS = 320; // how long the outgoing page keeps its leaving state
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// Page-by-page deck. One wheel step, arrow key or Space moves exactly one page.
// The new page is reported the moment the step starts, so the 3D flight and the
// in/out animations run with the scroll instead of after it.
export default function Deck({ pages, onIndex }: DeckProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const onIndexRef = useRef(onIndex);
  onIndexRef.current = onIndex;

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const sections = Array.from(box.querySelectorAll<HTMLElement>('[data-page]'));
    const last = sections.length - 1;
    let current = 0;
    let busyUntil = 0;
    let animating = false;
    let raf = 0;
    let settle = 0;
    const leaveTimers = new Map<HTMLElement, number>();

    const pageH = () => box.clientHeight;
    const nearest = () => Math.round(box.scrollTop / pageH());

    // Out-state on the old page, in-state on the new page, direction for both.
    const activate = (i: number, report: boolean) => {
      if (i === current) return;
      const dir = i > current ? 1 : -1;
      box.style.setProperty('--dir', String(dir));
      const old = sections[current];
      old.removeAttribute('data-active');
      old.setAttribute('data-leaving', '');
      window.clearTimeout(leaveTimers.get(old));
      leaveTimers.set(
        old,
        window.setTimeout(() => old.removeAttribute('data-leaving'), LEAVE_MS),
      );
      const next = sections[i];
      next.removeAttribute('data-leaving');
      next.setAttribute('data-active', '');
      current = i;
      if (report) onIndexRef.current(i);
    };

    const scrollToPage = (i: number) => {
      cancelAnimationFrame(raf);
      const to = i * pageH();
      if (reduced) {
        box.scrollTop = to;
        return;
      }
      const from = box.scrollTop;
      const t0 = performance.now();
      animating = true;
      box.style.scrollSnapType = 'none'; // snapping would fight the tween
      const frame = (now: number) => {
        const k = Math.min(1, (now - t0) / SCROLL_MS);
        box.scrollTop = from + (to - from) * easeOutCubic(k);
        if (k < 1) {
          raf = requestAnimationFrame(frame);
        } else {
          animating = false;
          box.style.scrollSnapType = '';
        }
      };
      raf = requestAnimationFrame(frame);
    };

    const goPage = (i: number) => {
      const t = Math.min(Math.max(i, 0), last);
      busyUntil = performance.now() + SCROLL_MS;
      activate(t, true);
      scrollToPage(t);
    };

    const step = (dir: number) => {
      if (performance.now() < busyUntil) return;
      if (current + dir < 0 || current + dir > last) return;
      goPage(current + dir);
    };

    // Touch swipes and the scrollbar move the page natively: sync once the scroll settles.
    const onScroll = () => {
      if (animating) return;
      window.clearTimeout(settle);
      settle = window.setTimeout(() => activate(nearest(), true), 120);
    };

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 4) return;
      e.preventDefault();
      step(Math.sign(e.deltaY));
    };

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      let dir = 0;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') dir = 1;
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') dir = -1;
      else if (e.key === ' ') dir = e.shiftKey ? -1 : 1;
      if (dir === 0) return;
      e.preventDefault();
      step(dir);
    };

    const onGoto = (e: Event) => goPage((e as CustomEvent<number>).detail);

    sections[0]?.setAttribute('data-active', '');
    window.addEventListener('deck:goto', onGoto);
    box.addEventListener('scroll', onScroll, { passive: true });
    box.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      leaveTimers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('deck:goto', onGoto);
      box.removeEventListener('scroll', onScroll);
      box.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, [pages.length]);

  return (
    <div
      ref={boxRef}
      className="fixed inset-0 z-[2] snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {pages.map((content, i) => (
        <section key={i} data-page className="relative h-screen w-full snap-start snap-always">
          <div data-layer className="flex h-full w-full items-center justify-center">
            {content}
          </div>
        </section>
      ))}
    </div>
  );
}
