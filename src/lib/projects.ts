export interface Project {
  id: string;
  title: string;
  tagline: string;
  url: string | null;
  // True when /public/walk has <id>.mp4 (walkthrough) and <id>.jpg (first frame).
  walk: boolean;
  // Static screenshot for projects without a walkthrough. NDA apps show their sign-in page only.
  shot?: string;
  tags: string[];
}

// Dialysis projects are NDA: sign-in page screenshot only, no link, no video.
export const projects: Project[] = [

  { id: 'paddlebase', title: 'PaddleBase', tagline: 'Book a pickleball court in Southern Mindanao.', url: 'https://paddlebase.org/', walk: true, tags: ['Booking', 'Web app'] },
  { id: 'paddlebase-owner', title: 'PaddleBase Owner Suite', tagline: 'Court POS and management for venue owners.', url: 'https://paddlebaseowner.org/', walk: true, tags: ['POS', 'Management'] },
  { id: 'icudrip', title: 'ICU Drip', tagline: 'Infusion and vasopressor calculator for nurses.', url: 'https://icudrip.com/', walk: true, tags: ['Medical', 'Calculator'] },
  { id: 'heyitsme', title: 'heyitsme', tagline: 'Free digital business card with QR code.', url: 'https://heyitsme.fyi/', walk: true, tags: ['Product'] },
  { id: 'hemoperfusion', title: 'Hemoperfusion Summit 2026', tagline: 'Event site for the 2026 summit.', url: 'https://almanalaysay93-gif.github.io/hemoperfusion-summit-/', walk: true, tags: ['Event'] },
  { id: 'mindanow', title: 'Transplant MindaNOW 2026', tagline: 'Registration site for the 5th transplant event.', url: 'https://transplantmindanow.redirectme.net/', walk: true, tags: ['Event', 'Registration'] },
  { id: 'autosocial', title: 'AutoSocial', tagline: 'Marketplace for vehicles and rentals.', url: 'https://autosocial-marketplace.vercel.app/', walk: true, tags: ['Marketplace'] },
  { id: 'organ-donor', title: 'SHARE Organ Donor Sign-up', tagline: 'Donor pledge site with a digital donor card.', url: 'https://almanalaysay93-gif.github.io/organ-donor-signup/', walk: true, tags: ['Medical', 'Sign-up'] },
  { id: 'dink', title: 'Dink for the Roots', tagline: 'Pickleball fundraising tournament registration.', url: 'https://dinkfortheroots.redirectme.net/', walk: true, tags: ['Event', 'Registration'] },
  { id: 'nurse-tracker', title: 'SKTI NurseTrack', tagline: 'Nurse database and staff credential tracker.', url: 'https://nodandnatracker.vercel.app/dashboard', walk: false, shot: '/shots/nurse-tracker.jpg', tags: ['Medical', 'Database'] },
  { id: 'dialysis-occupancy', title: 'Dialysis Occupancy Board', tagline: 'Hemodialysis queue and occupancy board.', url: null, walk: false, shot: '/shots/nda-dialysis-occupancy.jpg', tags: ['Medical', 'Queue', 'NDA'] },
  { id: 'dialysis-stock', title: 'Dialysis Stock Tracker', tagline: 'Dialysis supply stock tracking.', url: null, walk: false, shot: '/shots/nda-dialysis-stock.jpg', tags: ['Medical', 'NDA'] },
];