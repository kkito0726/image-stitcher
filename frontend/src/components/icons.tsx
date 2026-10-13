import type { ReactNode } from "react";

interface IconProps {
  size?: number;
  className?: string;
}

const StrokeIcon = ({ size = 18, className, children }: IconProps & { children: ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const CropIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M6 2L6 6L2 6" />
    <path d="M6 6L12 12" />
    <path d="M18 22L18 18L22 18" />
    <path d="M18 18L12 12" />
    <rect x="8" y="8" width="8" height="8" rx="1" />
  </StrokeIcon>
);

export const DownloadIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </StrokeIcon>
);

export const UploadIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </StrokeIcon>
);

export const ResetIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </StrokeIcon>
);

export const StitchIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </StrokeIcon>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <polyline points="15 18 9 12 15 6" />
  </StrokeIcon>
);

export const HomeIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </StrokeIcon>
);

export const RotateLeftIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38" />
  </StrokeIcon>
);

export const RotateRightIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" />
  </StrokeIcon>
);

export const ErrorCircleIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </StrokeIcon>
);

export const AlertCircleIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </StrokeIcon>
);

export const ImagePlaceholderIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
    <rect x="10" y="15" width="60" height="50" rx="4" />
    <path d="M10 50L25 35L40 50L55 35L70 50" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="28" cy="28" r="6" />
  </svg>
);

/** 重なった3枚の写真 + 下向き矢印（ドロップゾーン用） */
export const StackedPhotosIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
    <rect x="8" y="14" width="28" height="20" rx="3" stroke="var(--accent-primary)" strokeWidth="2" opacity="0.5" />
    <rect x="28" y="20" width="28" height="20" rx="3" stroke="var(--accent-primary)" strokeWidth="2" />
    <rect x="18" y="30" width="28" height="20" rx="3" stroke="var(--accent-secondary)" strokeWidth="2" opacity="0.7" />
    <path
      d="M32 44V56M32 56L26 50M32 56L38 50"
      stroke="var(--text-muted)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
