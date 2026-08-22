import type { LucideIcon } from 'lucide-react';

export type LogoSpec =
  | { kind: 'icon'; icon: LucideIcon }
  | { kind: 'svg'; path: string; viewBox?: string }
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'mono'; text: string };

interface BrandLogoProps {
  logo: LogoSpec;
  color: string;
  className?: string;
}

export function BrandLogo({ logo, color, className = 'h-5 w-5' }: BrandLogoProps) {
  if (logo.kind === 'icon') {
    const Icon = logo.icon;
    return <Icon className={className} style={{ color }} />;
  }

  if (logo.kind === 'svg') {
    return (
      <svg viewBox={logo.viewBox ?? '0 0 24 24'} className={className} fill={color} xmlns="http://www.w3.org/2000/svg">
        <path d={logo.path} />
      </svg>
    );
  }

  if (logo.kind === 'image') {
    return <img src={logo.src} alt={logo.alt} className={`${className} object-contain`} />;
  }

  return (
    <span className="text-[11px] font-bold tracking-tight" style={{ color }}>
      {logo.text}
    </span>
  );
}
