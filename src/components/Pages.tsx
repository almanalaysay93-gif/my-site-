import { useState, type CSSProperties, type FormEvent } from 'react';
import ScrollCue from '@/components/ScrollCue';
import { asset } from '@/lib/asset';
import { projects, type Project } from '@/lib/projects';
import { contact, downloadBlob, icsBlob, vCardBlob } from '@/lib/contact';

// Marks an element for the page in and out animation. i sets its place in the stagger.
const anim = (i: number) => ({ 'data-anim': '', style: { '--i': i } as CSSProperties });

export function HeroPage() {
  const medical = projects.filter((p) => p.tags.includes('Medical')).length;
  return (
    <div className="flex h-full w-full items-end px-6 pb-32 sm:px-12 lg:items-center lg:pb-0 lg:pl-[8vw]">
      <div className="max-w-xl">
        <p {...anim(0)} className="mb-6 font-mono text-[11px] uppercase tracking-[0.32em] text-[#9aa7b8]">Full-stack developer · Davao City</p>
        <div {...anim(1)} className="flex items-end gap-5">
          <h1 className="font-display text-[clamp(5rem,13vw,10.5rem)] leading-[0.82] tracking-[-0.02em] text-[#ece7dd]">
            AL<span className="text-[#8fdcff]">.</span>
          </h1>
          <img src={asset('/me.png')} alt="AL, developer" className="mb-2 h-[clamp(4rem,8vw,6.5rem)] w-[clamp(4rem,8vw,6.5rem)] shrink-0 rounded-full border border-white/15 object-cover object-top shadow-[0_0_40px_rgba(143,220,255,0.18)]" />
        </div>
        <p {...anim(2)} className="mt-6 max-w-md text-lg leading-relaxed text-[#aab4c3]">
          I build complete full-stack applications with AI tools in the workflow. Cleaner architecture, faster problem solving,
          higher quality products.
        </p>
        <p {...anim(3)} className="mt-5 font-mono text-xs tracking-wide text-[#8fdcff]">
          {projects.length} products shipped <span className="text-[#55627a]">/</span> {medical} in healthcare
        </p>
        <div {...anim(4)} className="mt-9 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => downloadBlob(vCardBlob(), `${contact.displayName}.vcf`)}
            className="rounded-full bg-[#ece7dd] px-6 py-3 text-sm font-semibold text-[#05070d] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8fdcff]"
          >
            Save contact
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('deck:goto', { detail: 1 }))}
            className="rounded-full border border-white/20 px-6 py-3 text-sm text-[#ece7dd] transition-colors hover:border-white/50 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8fdcff]"
          >
            See the work →
          </button>
        </div>
      </div>
      <ScrollCue />
    </div>
  );
}

// Project page overlay. The site itself plays on the 3D panel behind it.
export function ProjectCaption({ project }: { project: Project }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 bg-gradient-to-t from-black/70 to-transparent px-4 pb-8 pt-16 sm:px-10">
      <div {...anim(0)}>
        <h3 className="font-display text-3xl text-[#ece7dd] sm:text-4xl">{project.title}</h3>
        <p className="text-sm text-[#8fa6c4] sm:text-base">{project.tagline}</p>
      </div>
      {project.url ? (
        <a
          {...anim(1)}
          href={project.url}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-[#ece7dd] hover:bg-white transition-colors px-5 py-2 text-sm font-bold text-[#05070d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4fd8ff]"
        >
          Visit live site
        </a>
      ) : (
        <span {...anim(1)} className="text-sm text-[#8fa6c4]">Under NDA. Details on request.</span>
      )}
    </div>
  );
}

const links = [
  { label: 'Email', value: contact.email, href: `mailto:${contact.email}` },
  { label: 'Call', value: '+63 906 410 9901', href: `tel:${contact.phone}` },
  { label: 'Text', value: '+63 906 410 9901', href: `sms:${contact.phone}` },
  { label: 'WhatsApp', value: 'Message me', href: 'https://wa.me/639064109901' },
  { label: 'Viber', value: 'Message me', href: 'viber://chat?number=%2B639064109901' },
  { label: 'Telegram', value: 'Message me', href: 'https://t.me/+639064109901' },
  { label: 'LinkedIn', value: 'Profile', href: 'https://www.linkedin.com/in/al-john-manalaysay-3b0127335/' },
  { label: 'Facebook', value: 'Profile', href: 'https://www.facebook.com/share/1C9nqyLteE/' },
];

export function ContactPage() {
  return (
    <div className="mx-4 w-full max-w-4xl rounded-3xl border border-white/10 bg-[#05070d]/35 p-6 shadow-2xl backdrop-blur-md sm:p-10">
      <h2 {...anim(0)} className="mb-8 text-center font-display text-5xl text-[#ece7dd] sm:text-6xl">Reach me</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {links.map((l, n) => (
          <a
            {...anim(1 + n * 0.5)}
            key={l.label}
            href={l.href}
            target={l.href.startsWith('http') ? '_blank' : undefined}
            rel={l.href.startsWith('http') ? 'noopener' : undefined}
            className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-black/50 p-5 backdrop-blur-md transition-transform hover:-translate-y-1 hover:border-[#4fd8ff] focus-visible:outline-2 focus-visible:outline-[#4fd8ff]"
          >
            <span className="text-xs uppercase tracking-[0.15em] text-[#4fd8ff]">{l.label}</span>
            <span className="break-words font-semibold text-[#eaf4ff]">{l.value}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

const times = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

export function BookPage() {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');

  const onBook = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!date || !name.trim()) {
      setStatus('Add a date and your name.');
      return;
    }
    // Asia/Manila is UTC+8 with no daylight time.
    downloadBlob(icsBlob(`${date}T${time}:00+08:00`), `meeting-with-${contact.displayName}.ics`);
    const subject = encodeURIComponent(`Meeting request: ${date} ${time} (Asia/Manila)`);
    const body = encodeURIComponent(`Hi AL, this is ${name.trim()}. I would like a 30 minute meeting on ${date} at ${time} (Asia/Manila).`);
    setStatus('Invite downloaded. Opening your email to send it to AL.');
    window.location.href = `mailto:${contact.email}?subject=${subject}&body=${body}`;
  };

  const fieldClass =
    'rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-[#eaf4ff] focus-visible:outline-2 focus-visible:outline-[#4fd8ff]';

  return (
    <div className="mx-4 w-full max-w-2xl rounded-3xl border border-white/10 bg-[#05070d]/85 p-6 shadow-2xl backdrop-blur-xl sm:p-10">
      <h2 {...anim(0)} className="mb-3 text-center font-display text-5xl text-[#ece7dd] sm:text-6xl">Book a meeting</h2>
      <p {...anim(1)} className="mb-8 text-center text-[#8fa6c4]">Pick a day and time. You get a 30 minute invite to send to AL.</p>
      <form {...anim(2)} onSubmit={onBook} className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-[#8fa6c4]">
          Date
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-2 text-sm text-[#8fa6c4]">
          Time (Asia/Manila)
          <select value={time} onChange={(e) => setTime(e.target.value)} className={fieldClass}>
            {times.map((t) => (
              <option key={t} value={t} className="bg-[#07101f]">
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-[#8fa6c4] sm:col-span-2">
          Your name
          <input type="text" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
        </label>
        <button
          type="submit"
          className="rounded-full bg-[#ece7dd] hover:bg-white transition-colors px-6 py-3 font-bold text-[#05070d] sm:col-span-2 sm:justify-self-start focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4fd8ff]"
        >
          Create invite
        </button>
      </form>
      <p role="status" className="mt-4 min-h-6 text-center text-[#4fd8ff]">
        {status}
      </p>
    </div>
  );
}
