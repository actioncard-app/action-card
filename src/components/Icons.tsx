// Small inline SVG icons (no icon font, no network). All decorative: aria-hidden, the text next to them carries the meaning.
type P = { size?: number };
const svg = (size: number, body: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{body}</svg>
);
export const IconCamera = ({ size = 24 }: P) => svg(size, <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.6" /></>);
export const IconImage = ({ size = 24 }: P) => svg(size, <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="8.5" cy="9.5" r="1.8" /><path d="m21 16-5-5-9 9" /></>);
export const IconStack = ({ size = 24 }: P) => svg(size, <><rect x="4" y="9" width="16" height="11" rx="2" /><path d="M7 6h10M9 3h6" /></>);
export const IconGear = ({ size = 24 }: P) => svg(size, <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
export const IconCalendar = ({ size = 20 }: P) => svg(size, <><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M16 3v4M8 3v4M3 10h18" /></>);
export const IconCoins = ({ size = 20 }: P) => svg(size, <><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v5M18 9.5v5" /></>);
export const IconArrow = ({ size = 20 }: P) => svg(size, <><path d="M5 12h14M13 6l6 6-6 6" /></>);
export const IconCheck = ({ size = 18 }: P) => svg(size, <path d="m5 12.5 4.5 4.5L19 7.5" />);
export const IconTrash = ({ size = 20 }: P) => svg(size, <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>);
export const IconPencil = ({ size = 16 }: P) => svg(size, <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>);
export const IconAlert = ({ size = 18 }: P) => svg(size, <><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4.5M12 17.3v.2" /></>);
export const IconShield = ({ size = 20 }: P) => svg(size, <><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>);
export const IconSpark = ({ size = 20 }: P) => svg(size, <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></>);
export const IconGlobe = ({ size = 20 }: P) => svg(size, <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></>);
export const IconInfo = ({ size = 20 }: P) => svg(size, <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.2" /></>);
export const IconDoc = ({ size = 20 }: P) => svg(size, <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>);
export const IconDownload = ({ size = 20 }: P) => svg(size, <><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></>);
export const IconPlus = ({ size = 20 }: P) => svg(size, <path d="M12 5v14M5 12h14" />);
export const IconShare = ({ size = 20 }: P) => svg(size, <><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 12v8h14v-8" /></>);
export const IconBack = ({ size = 22 }: P) => svg(size, <path d="m15 5-7 7 7 7" />);
