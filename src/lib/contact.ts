export const contact = {
  name: 'AL JOHN PALENZUELA MANALAYSAY',
  displayName: 'AL',
  email: 'almanalaysay93@gmail.com',
  phone: '+639064109901',
};

// vCard 3.0 file so a phone can save the contact.
export function vCardBlob(): Blob {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Manalaysay;Al John Palenzuela;;;',
    `FN:${contact.name}`,
    'ORG:Auxillum',
    'TITLE:Developer',
    `TEL;TYPE=CELL,VOICE:${contact.phone}`,
    `EMAIL;TYPE=INTERNET:${contact.email}`,
    'ADR;TYPE=WORK:;;Davao City;;;;Philippines',
    'URL:https://www.linkedin.com/in/al-john-manalaysay-3b0127335/',
    'END:VCARD',
  ];
  return new Blob([lines.join('\r\n')], { type: 'text/vcard' });
}

// 30 minute meeting invite. startIso must carry an offset, for example +08:00.
export function icsBlob(startIso: string): Blob {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AL Portfolio//Meeting//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@al-portfolio`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:Meeting with ${contact.displayName}`,
    `ATTENDEE;CN=${contact.displayName}:mailto:${contact.email}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return new Blob([lines.join('\r\n')], { type: 'text/calendar' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
