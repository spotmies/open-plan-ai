import { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Minus, Maximize, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { BOMNode } from './bomData';
import { BOMStatusPill, PartImageThumb } from './BOMShared';
import { useCurrency } from '@/hooks/useCurrency';

interface Props {
  nodes: BOMNode[];
  onOpen: (id: string) => void;
  pred?: (n: BOMNode) => boolean;
  filtersActive?: boolean;
}

const NW = 216, NH = 98, HGAP = 200, VGAP = 8;
const MM_W = 168, MM_H = 110, MM_PAD = 8, MM_GRID = 240;


const STATUS_COLORS = {
  approved: { color: '#16A34A', soft: 'rgba(34,197,94,0.5)' },
  pending: { color: '#D97706', soft: 'rgba(245,158,11,0.5)' },
};

interface DragState {
  type: 'node' | 'pan';
  id?: string;
  startX: number; startY: number;
  ox?: number; oy?: number;
  px?: number; py?: number;
  zoom: number;
  moved: boolean;
}

export function BOMMapView({ nodes, onOpen, pred, filtersActive }: Props) {
  const { formatCurrency } = useCurrency();
  const containerRef = useRef<HTMLDivElement>(null);
  const mmRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 56, y: 40 });
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    try { return JSON.parse(localStorage.getItem('bom_map_pos') || '{}'); } catch { return {}; }
  });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('bom_map_collapsed') || '{}'); } catch { return {}; }
  });
  const [hovered, setHovered] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => setIsFullscreen(f => !f);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(([entry]) => setVp({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    localStorage.setItem('bom_map_collapsed', JSON.stringify(collapsed));
  }, [collapsed]);

  const stOf = (n: BOMNode) => STATUS_COLORS[n.status] ?? STATUS_COLORS.pending;
  const dim = (n: BOMNode) => filtersActive && pred && !pred(n);

  // tidy layout
  const { layoutVersion, depthMap } = useMemo(() => {
    const depthMap = new Map<string, number>();
    let leafY = 0;
    const place = (node: BOMNode, depth: number): number => {
      node._x = depth * (NW + HGAP);
      depthMap.set(node.id, depth);
      const kids = (node.children && !collapsed[node.id]) ? node.children : null;
      if (!kids || !kids.length) { node._y = leafY; leafY += NH + VGAP; return node._y + NH / 2; }
      const centers = kids.map(k => place(k, depth + 1));
      const center = (centers[0] + centers[centers.length - 1]) / 2;
      node._y = center - NH / 2;
      return center;
    };
    nodes.forEach(r => place(r, 0));
    return { layoutVersion: Date.now(), depthMap };
  }, [collapsed, nodes]);

  // visible + edges
  const { visible, edges } = useMemo(() => {
    const visible: BOMNode[] = [], edges: [BOMNode, BOMNode][] = [];
    const walk = (node: BOMNode) => {
      visible.push(node);
      if (node.children && !collapsed[node.id]) {
        node.children.forEach(c => { edges.push([node, c]); walk(c); });
      }
    };
    nodes.forEach(walk);
    return { visible, edges };
  }, [collapsed, nodes, layoutVersion]);

  const usedDepths = useMemo(() => {
    const depths = new Set<number>();
    visible.forEach(n => { const d = depthMap.get(n.id); if (d !== undefined) depths.add(d); });
    return Array.from(depths).sort((a, b) => a - b);
  }, [visible, depthMap]);

  const eff = (n: BOMNode) => positions[n.id] ?? { x: n._x ?? 0, y: n._y ?? 0 };

  const bounds = visible.reduce(
    (b, n) => { const p = eff(n); return { w: Math.max(b.w, p.x + NW), h: Math.max(b.h, p.y + NH) }; },
    { w: 600, h: 400 }
  );

  const mmScale = Math.min((MM_W - MM_PAD * 2) / bounds.w, (MM_H - MM_PAD * 2) / bounds.h, 1);
  const viewportRect = vp.w ? { x: -pan.x / zoom, y: -pan.y / zoom, w: vp.w / zoom, h: vp.h / zoom } : null;

  // drag/pan
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current; if (!d) return;
      if (d.type === 'node' && d.id) {
        const dx = (e.clientX - d.startX) / d.zoom, dy = (e.clientY - d.startY) / d.zoom;
        if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 4) d.moved = true;
        setPositions(p => ({ ...p, [d.id!]: { x: (d.ox ?? 0) + dx, y: (d.oy ?? 0) + dy } }));
      } else if (d.type === 'pan') {
        d.moved = true;
        setPan({ x: (d.px ?? 0) + (e.clientX - d.startX), y: (d.py ?? 0) + (e.clientY - d.startY) });
      }
    };
    const onUp = () => {
      const d = dragRef.current; if (!d) return;
      if (d.type === 'node') {
        setDragId(null);
        if (!d.moved) onOpen(d.id!);
        else setPositions(p => { localStorage.setItem('bom_map_pos', JSON.stringify(p)); return p; });
      }
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [onOpen]);

  // wheel zoom
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      setZoom(z => {
        const nz = Math.min(2, Math.max(0.08, z * (e.deltaY < 0 ? 1.12 : 0.89)));
        setPan(p => ({ x: cx - ((cx - p.x) / z) * nz, y: cy - ((cy - p.y) / z) * nz }));
        return nz;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const startNodeDrag = (e: React.MouseEvent, n: BOMNode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const p = eff(n);
    dragRef.current = { type: 'node', id: n.id, startX: e.clientX, startY: e.clientY, ox: p.x, oy: p.y, zoom, moved: false };
    setDragId(n.id);
  };
  const startPan = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { type: 'pan', startX: e.clientX, startY: e.clientY, px: pan.x, py: pan.y, zoom, moved: false };
  };

  const zoomBy = (f: number) => setZoom(z => {
    const nz = Math.min(2, Math.max(0.08, z * f));
    const el = containerRef.current;
    if (el) { const r = el.getBoundingClientRect(); const cx = r.width / 2, cy = r.height / 2; setPan(p => ({ x: cx - ((cx - p.x) / z) * nz, y: cy - ((cy - p.y) / z) * nz })); }
    return nz;
  });

  const fit = () => {
    const el = containerRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const nz = Math.min(2, Math.max(0.08, Math.min((r.width - 100) / bounds.w, (r.height - 100) / bounds.h)));
    setZoom(nz);
    setPan({ x: (r.width - bounds.w * nz) / 2, y: (r.height - bounds.h * nz) / 2 });
  };
  const resetLayout = () => { setPositions({}); localStorage.removeItem('bom_map_pos'); };

  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current) return;
    const t = setTimeout(() => { fit(); didFit.current = true; }, 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const t = setTimeout(fit, 60);
    return () => clearTimeout(t);
  }, [isFullscreen]);

  const CtrlBtn = ({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) => (
    <button onClick={onClick} title={title}
      className="w-8 h-8 rounded-lg bg-card border border-border cursor-pointer flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
      {children}
    </button>
  );

  return (
    <div
      ref={containerRef}
      onMouseDown={startPan}
      className="flex-1 relative overflow-hidden border-t border-border bg-background cursor-grab"
      style={{
        backgroundImage: `radial-gradient(var(--border) 1px, transparent 1px)`,
        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        ...(isFullscreen ? { position: 'fixed', inset: 0, zIndex: 9999 } : {}),
      }}
    >
      {/* Canvas */}
      <div style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '0 0', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>

        {/* Edges */}
        <svg
          width={bounds.w + 40} height={bounds.h + 40}
          style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}
        >
          {edges.map(([a, b]) => {
            const pa = eff(a), pb = eff(b);
            const x1 = pa.x + NW, y1 = pa.y + NH / 2, x2 = pb.x, y2 = pb.y + NH / 2;
            const dx = Math.max(40, (x2 - x1) / 2);
            const faded = dim(a) || dim(b);
            const col = stOf(b).color;
            return (
              <path
                key={`${a.id}>${b.id}`}
                d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                fill="none" stroke={col} strokeWidth={1.6} strokeOpacity={faded ? 0.08 : 0.45}
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {visible.map(n => {
          const p = eff(n);
          const st = stOf(n);
          const isH = hovered === n.id, isDrag = dragId === n.id, faded = dim(n);
          const hasKids = n.children && n.children.length;
          const isCol = !!collapsed[n.id];
          return (
            <div
              key={n.id}
              onMouseDown={e => startNodeDrag(e, n)}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                position: 'absolute', left: p.x, top: p.y, width: NW, minHeight: NH,
                background: 'var(--card)',
                border: `1.5px solid ${isH || isDrag ? st.color : st.soft}`,
                borderLeft: `3px solid ${st.color}`,
                borderRadius: 11,
                boxShadow: isDrag ? '0 12px 28px rgba(20,24,31,0.18)' : isH ? '0 6px 16px rgba(20,24,31,0.12)' : '0 1px 3px rgba(20,24,31,0.07)',
                cursor: isDrag ? 'grabbing' : 'grab',
                opacity: faded ? 0.25 : 1,
                zIndex: isDrag ? 100 : isH ? 50 : 10,
                transition: isDrag ? 'none' : 'box-shadow .12s, border-color .12s, opacity .15s',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', gap: 10, padding: '10px 12px 0' }}>
                <PartImageThumb nodeId={n.id} cat={n.cat} size={38} radius={8} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 500, color: '#2563EB', fontFamily: 'var(--font-mono, monospace)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.pn}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'var(--foreground)' }}>
                    {n.desc}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 10px' }}>
                <BOMStatusPill status={n.status} />
                <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>
                  ×{n.qty} <span style={{ color: 'var(--muted-foreground)' }}>·</span>{' '}
                  <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{formatCurrency(n.price)}</span>
                </span>
              </div>

              {hasKids ? (
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); setCollapsed(c => ({ ...c, [n.id]: !c[n.id] })); }}
                  title={isCol ? 'Expand branch' : 'Collapse branch'}
                  style={{
                    position: 'absolute', right: -12, top: NH / 2 - 12,
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'var(--card)', border: `1px solid ${st.soft}`,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: st.color, zIndex: 20, padding: 0,
                  }}
                >
                  {isCol
                    ? <span style={{ fontSize: 10, fontWeight: 700, color: st.color }}>{n.children!.length}</span>
                    : <Minus style={{ width: 13, height: 13, color: st.color }} />}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="absolute top-3.5 right-4 flex flex-col gap-1.5 z-50">
        <CtrlBtn onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </CtrlBtn>
        <div className="w-full h-px bg-border my-0.5" />
        <CtrlBtn onClick={() => zoomBy(1.15)} title="Zoom in"><Plus className="w-4 h-4" /></CtrlBtn>
        <div className="text-center text-[10.5px] text-muted-foreground tabular-nums">{Math.round(zoom * 100)}%</div>
        <CtrlBtn onClick={() => zoomBy(0.87)} title="Zoom out"><Minus className="w-4 h-4" /></CtrlBtn>
        <CtrlBtn onClick={fit} title="Fit to screen"><Maximize className="w-3.5 h-3.5" /></CtrlBtn>
        <CtrlBtn onClick={resetLayout} title="Tidy up (auto-arrange nodes)"><RefreshCw className="w-4 h-4" /></CtrlBtn>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3.5 left-4 flex items-center gap-4 px-3 py-1.5 bg-card border border-border rounded-lg z-50">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm" style={{ background: '#16A34A' }} />
          <span className="text-[11px] text-muted-foreground">Approved</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm" style={{ background: '#D97706' }} />
          <span className="text-[11px] text-muted-foreground">Pending</span>
        </div>
        <div className="w-px h-3.5 bg-border" />
        <span className="text-[11px] text-muted-foreground">Drag nodes · scroll to zoom · click to open</span>
      </div>

      {/* Minimap */}
      <div
        ref={mmRef}
        onMouseDown={e => {
          e.stopPropagation();
          const rect = mmRef.current!.getBoundingClientRect();
          const cx = (e.clientX - rect.left - MM_PAD) / mmScale;
          const cy = (e.clientY - rect.top - MM_PAD) / mmScale;
          const cr = containerRef.current?.getBoundingClientRect();
          if (cr) setPan({ x: cr.width / 2 - cx * zoom, y: cr.height / 2 - cy * zoom });
        }}
        title="Click to jump to area"
        className="hidden md:block absolute bottom-3.5 right-4 bg-card border border-border rounded-lg overflow-hidden cursor-pointer z-50"
        style={{ width: MM_W, height: MM_H }}
      >
        {/* Grid (anchored to canvas origin, same as main canvas) */}
        <div
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage:
              'linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)',
            backgroundSize: `${MM_GRID * mmScale}px ${MM_GRID * mmScale}px`,
            backgroundPosition: `${MM_PAD}px ${MM_PAD}px`,
            opacity: 0.6,
          }}
        />
        {visible.map(n => {
          const p = eff(n);
          return (
            <div
              key={n.id}
              style={{
                position: 'absolute',
                left: MM_PAD + p.x * mmScale,
                top: MM_PAD + p.y * mmScale,
                width: Math.max(3, NW * mmScale),
                height: Math.max(2, NH * mmScale),
                background: stOf(n).color,
                opacity: dim(n) ? 0.25 : 0.8,
                borderRadius: 1.5,
              }}
            />
          );
        })}
        {viewportRect && (
          <div
            style={{
              position: 'absolute',
              left: MM_PAD + viewportRect.x * mmScale,
              top: MM_PAD + viewportRect.y * mmScale,
              width: viewportRect.w * mmScale,
              height: viewportRect.h * mmScale,
              border: '1.5px solid var(--foreground)',
              opacity: 0.55,
              borderRadius: 2,
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
}
