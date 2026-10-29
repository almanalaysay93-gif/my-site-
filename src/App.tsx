import { useEffect, useRef } from 'react';
import { asset } from '@/lib/asset';
import DataRain from '@/components/ui/data-rain';
import FlyScene, { PAGE_COUNT, type FlyHandle } from '@/components/FlyScene';
import Deck from '@/components/Deck';
import ContactBar from '@/components/ContactBar';
import { BookPage, ContactPage, HeroPage, ProjectCaption } from '@/components/Pages';
import { SMALL_SCREEN } from '@/lib/sample';
import { projects } from '@/lib/projects';

// One page per step. Each step flies the 3D camera to that page's panel.
export default function App() {
  const flyRef = useRef<FlyHandle>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  const onIndex = (i: number) => {
    flyRef.current?.flyTo(i);
    if (progressRef.current) progressRef.current.style.transform = `scaleX(${i / (PAGE_COUNT - 1)})`;
  };

  // On fast connections, fetch the first walkthrough while the visitor is on the hero. Only one, so it never competes with the video being watched.
  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
    if (conn?.saveData || (conn?.effectiveType && conn.effectiveType !== '4g')) return;
    const t = window.setTimeout(() => {
      projects.filter((p) => p.walk).slice(0, 1).forEach((p) => {
        fetch(asset(`/walk/${p.id}.mp4`)).then((r) => r.blob()).catch(() => undefined);
      });
    }, 4000);
    return () => window.clearTimeout(t);
  }, []);

  const pages = [
    <HeroPage key="hero" />,
    ...projects.map((p) => <ProjectCaption key={p.id} project={p} />),
    <ContactPage key="contact" />,
    <BookPage key="book" />,
  ];

  return (
    <>
      <DataRain fullscreen count={SMALL_SCREEN ? 500 : undefined} />
      {/* Glimpse: the photo shows, then the particles gather into it (timed to the intro in FlyScene). */}
      <div aria-hidden="true" className="glimpse pointer-events-none fixed inset-0 z-[1] flex items-center justify-center md:justify-end md:pr-[10vw]">
        <img src="/portrait.png" alt="" className="w-[62vw] max-w-[320px] rounded-2xl object-cover md:w-[34vw] md:max-w-[420px]" />
      </div>
      <FlyScene ref={flyRef} className="pointer-events-none fixed inset-0 z-[1]" />

      <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-4 py-4 backdrop-blur-md sm:px-8">
        <span className="font-display text-2xl text-[#ece7dd]">AL<span className="text-[#8fdcff]">.</span></span>
      </header>
      <div
        ref={progressRef}
        className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-[#8fdcff]"
        style={{ transform: 'scaleX(0)' }}
      />

      <Deck pages={pages} onIndex={onIndex} />
      <ContactBar />
    </>
  );
}
