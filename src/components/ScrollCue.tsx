// Scroll cue: a mouse outline with a wheel dot that runs down.
export default function ScrollCue() {
  return (
    <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#8fa6c4]">
      <svg width="26" height="40" viewBox="0 0 26 40" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="1" y="1" width="24" height="38" rx="12" />
        <rect className="scroll-wheel" x="11.5" y="8" width="3" height="7" rx="1.5" fill="currentColor" stroke="none" />
      </svg>
      <span>Scroll</span>
    </div>
  );
}
