import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

const base = (p: P) => ({
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
});

export const IconSearch = (p: P) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);

export const IconGrid = (p: P) => (
  <svg {...base(p)}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
);

export const IconList = (p: P) => (
  <svg {...base(p)}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
);

export const IconUpload = (p: P) => (
  <svg {...base(p)}><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
);

export const IconFolderPlus = (p: P) => (
  <svg {...base(p)}><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h6a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /><path d="M12 11v5M9.5 13.5h5" /></svg>
);

export const IconFolder = (p: P) => (
  <svg {...base(p)}><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h6a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>
);

export const IconDots = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="5" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="19" r="1.4" fill="currentColor" /></svg>
);

export const IconDownload = (p: P) => (
  <svg {...base(p)}><path d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5" /><path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" /></svg>
);

export const IconRename = (p: P) => (
  <svg {...base(p)}><path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5V20Z" /><path d="M13.5 6.5 17.5 10.5" /></svg>
);

export const IconMove = (p: P) => (
  <svg {...base(p)}><path d="M3 7a2 2 0 0 1 2-2h3l2 2.5h9a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /><path d="M12 11v5m0 0-2-2m2 2 2-2" /></svg>
);

export const IconTrash = (p: P) => (
  <svg {...base(p)}><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" /><path d="M10 11v6M14 11v6" /></svg>
);

export const IconX = (p: P) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);

export const IconChevronRight = (p: P) => (
  <svg {...base(p)}><path d="m9 5 7 7-7 7" /></svg>
);

export const IconChevronLeft = (p: P) => (
  <svg {...base(p)}><path d="m15 5-7 7 7 7" /></svg>
);

export const IconHome = (p: P) => (
  <svg {...base(p)}><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8.5Z" /></svg>
);

export const IconImage = (p: P) => (
  <svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="m4 17 4.5-4.5L12 16l3-3 5 5" /></svg>
);

export const IconVideo = (p: P) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9.5 5 2.5-5 2.5v-5Z" /></svg>
);

export const IconAudio = (p: P) => (
  <svg {...base(p)}><path d="M4 14v-3a2 2 0 0 1 2-2h1l6-3v13l-6-3H6a2 2 0 0 1-2-2Z" /><path d="M17 8a5 5 0 0 1 0 8" /></svg>
);

export const IconDoc = (p: P) => (
  <svg {...base(p)}><path d="M6 3h7l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M13 3v5h5" /><path d="M8 13h8M8 17h5" /></svg>
);

export const IconArchive = (p: P) => (
  <svg {...base(p)}><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" /><path d="M10.5 13h3" /></svg>
);

export const IconCode = (p: P) => (
  <svg {...base(p)}><path d="m8 8-4 4 4 4M16 8l4 4-4 4" /></svg>
);

export const IconFile = (p: P) => (
  <svg {...base(p)}><path d="M6 3h7l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M13 3v5h5" /></svg>
);

export const IconCloud = (p: P) => (
  <svg {...base(p)}><path d="M7 18a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17.5 9a3.75 3.75 0 0 1 .5 7.5H7Z" /></svg>
);

export const IconArrowUp = (p: P) => (
  <svg {...base(p)}><path d="M12 19V5m0 0-6 6m6-6 6 6" /></svg>
);

export const IconSort = (p: P) => (
  <svg {...base(p)}><path d="M7 4v16m0 0-3-3m3 3 3-3" /><path d="M17 20V4m0 0-3 3m3-3 3 3" /></svg>
);

export const IconRefresh = (p: P) => (
  <svg {...base(p)}><path d="M20 11a8 8 0 1 0-2.5 5.8" /><path d="M20 5v6h-6" /></svg>
);

export const IconInfo = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
);

export const IconShield = (p: P) => (
  <svg {...base(p)}><path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>
);

export const IconSettings = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
);

export const IconLogout = (p: P) => (
  <svg {...base(p)}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5M5 12h10" /></svg>
);

export const IconUser = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
);

export const IconChart = (p: P) => (
  <svg {...base(p)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
);

export const IconAlert = (p: P) => (
  <svg {...base(p)}><path d="M12 4.5 21 19H3l9-14.5Z" /><path d="M12 10v4M12 17h.01" /></svg>
);

export const IconMonitor = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M9 20h6M12 16v4" />
  </svg>
);

export const IconEye = (p: P) => (
  <svg {...base(p)}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconCamera = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
    <circle cx="12" cy="13" r="3.2" />
  </svg>
);

export const IconKey = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="4" />
    <path d="M11 11l8 8M17 17l2-2M14 14l2-2" />
  </svg>
);

export const IconSliders = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="8" cy="12" r="2" />
    <circle cx="13" cy="18" r="2" />
  </svg>
);

export const IconArrowLeft = (p: P) => (
  <svg {...base(p)}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);

export const IconCheck = (p: P) => (
  <svg {...base(p)}><path d="M5 12.5 10 17.5 19.5 7" /></svg>
);

export const IconShare = (p: P) => (
  <svg {...base(p)}>
    <path d="M18 8a3 3 0 1 0-2.8-4L8.9 8.4a3 3 0 1 0 0 7.2l6.3 4.4A3 3 0 1 0 18 16a3 3 0 0 0-1.1-2.3L10.6 9.3A3 3 0 0 0 18 8Z" />
  </svg>
);

export const IconLink = (p: P) => (
  <svg {...base(p)}>
    <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
  </svg>
);

export const IconCopy = (p: P) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2" />
  </svg>
);
