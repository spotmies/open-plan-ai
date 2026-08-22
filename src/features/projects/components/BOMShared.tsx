// Shared micro-components for BOM views
import {
  Zap, Cpu, Package, Box, Monitor, Shield, Layers, X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BOMCategory, BOMStatus, getCategoryMeta } from './bomData';
import { Link2 } from 'lucide-react';
import { useBomDocuments, isImageAttachment } from '@/hooks/useBomDocuments';
import { resolveFileUrl } from '@/utils/fileUrl';

const CAT_ICONS: Record<BOMCategory, React.ElementType> = {
  power: Zap, control: Cpu, connector: Package, enclosure: Box,
  hmi: Monitor, safety: Shield, assembly: Layers,
};

export function PartThumb({
  cat, size = 32, radius = 7, big = false, height, bordered = true, imageUrl, onImageClick,
}: { cat: BOMCategory; size?: number; radius?: number; big?: boolean; height?: number; bordered?: boolean; imageUrl?: string | null; onImageClick?: () => void }) {
  const meta = getCategoryMeta(cat);
  const Icon = CAT_ICONS[cat] ?? Package;
  const iconSize = big ? 34 : Math.round(size * 0.46);

  const patternSize = big ? 9 : 6;
  const containerStyle: React.CSSProperties = {
    width: big ? '100%' : size,
    height: big ? (height ?? 132) : size,
    borderRadius: radius,
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
    border: bordered ? '1px solid hsl(var(--border))' : undefined,
    background: `${meta.tint}0d`,
    backgroundImage: imageUrl ? undefined : `repeating-linear-gradient(135deg, ${meta.tint}1f 0, ${meta.tint}1f 1px, transparent 1px, transparent ${patternSize}px)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (imageUrl) {
    return (
      <div
        style={{ ...containerStyle, cursor: onImageClick ? 'zoom-in' : undefined }}
        onClick={onImageClick}
      >
        <img src={imageUrl} alt="" className="w-full h-full object-contain" />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <Icon style={{ width: iconSize, height: iconSize, color: meta.tint }} />
      {big && (
        <span
          className="absolute bottom-2 left-0 right-0 text-center text-[9px] tracking-widest font-mono text-muted-foreground uppercase"
        >
          part photo
        </span>
      )}
    </div>
  );
}

export function ImageViewerModal({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt=""
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '90vw',
          maxHeight: '90vh',
          objectFit: 'contain',
          borderRadius: 8,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      />
    </div>,
    document.body,
  );
}

const ZOOM_SIZE = 240;
const ZOOM_GAP = 10;

// Wraps any thumbnail element with an Amazon-style enlarged preview that
// appears next to it on hover. Pass `enabled={false}` (or omit `imageUrl`)
// to render `children` inert, e.g. when there's no photo to zoom into.
export function HoverZoomImage({
  imageUrl, enabled = true, children,
}: { imageUrl?: string | null; enabled?: boolean; children: React.ReactNode }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [zoomPos, setZoomPos] = useState<{ top: number; left?: number; right?: number } | null>(null);

  const handleEnter = () => {
    if (!enabled || !imageUrl || !anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const openRight = r.right + ZOOM_GAP + ZOOM_SIZE <= window.innerWidth;

    const top = Math.min(Math.max(r.top, 8), window.innerHeight - ZOOM_SIZE - 8);

    if (openRight) {
      setZoomPos({ top, left: r.right + ZOOM_GAP });
    } else {
      setZoomPos({ top, right: window.innerWidth - r.left + ZOOM_GAP });
    }
  };
  const handleLeave = () => setZoomPos(null);

  return (
    <div ref={anchorRef} onMouseEnter={handleEnter} onMouseLeave={handleLeave} className="shrink-0">
      {children}
      {enabled && zoomPos && imageUrl && createPortal(
        <div
          style={{
            position: 'fixed',
            top: zoomPos.top,
            left: zoomPos.left,
            right: zoomPos.right,
            padding: 6,
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(20,24,31,0.25)',
            zIndex: 1000,
            pointerEvents: 'none',
            display: 'flex',
          }}
        >
          <img
            src={imageUrl}
            alt=""
            style={{ width: ZOOM_SIZE, height: ZOOM_SIZE, objectFit: 'contain', borderRadius: 6, display: 'block', background: 'hsl(var(--background))' }}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}

// Part thumbnail that fetches the part's uploaded photo (if any) and falls
// back to the plain category-icon `PartThumb` when no photo exists. Pass
// `hoverZoom` to show an Amazon-style enlarged preview on hover (List view).
export function PartImageThumb({
  nodeId, cat, size = 32, radius = 7, big = false, hoverZoom = false,
}: { nodeId: string; cat: BOMCategory; size?: number; radius?: number; big?: boolean; hoverZoom?: boolean }) {
  const { data: docs } = useBomDocuments(nodeId);
  const imageUrl = useMemo(() => {
    const photo = (docs ?? []).find(isImageAttachment);
    return photo ? resolveFileUrl(photo.fileUrl) : null;
  }, [docs]);

  return (
    <HoverZoomImage imageUrl={imageUrl} enabled={hoverZoom}>
      <PartThumb cat={cat} size={size} radius={radius} big={big} imageUrl={imageUrl} />
    </HoverZoomImage>
  );
}

export function BOMStatusPill({ status }: { status: BOMStatus }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
        style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.2)' }}>
        Approved
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
        style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)' }}>
        Rejected
      </span>
    );
  }
  if (status === 'draft') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
        style={{ background: 'rgba(100,116,139,0.1)', color: '#64748B', border: '1px solid rgba(100,116,139,0.2)' }}>
        Draft
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ background: 'rgba(245,158,11,0.1)', color: '#D97706', border: '1px solid rgba(245,158,11,0.2)' }}>
      Pending Review
    </span>
  );
}

export function ReqTag({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap transition-colors bg-muted text-foreground border border-border hover:bg-accent"
    >
      <Link2 style={{ width: 10, height: 10 }} />
      {label}
    </span>
  );
}
