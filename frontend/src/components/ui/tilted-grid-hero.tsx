'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

/* ── the curved row ──────────────────────────────────────────────
 * Scroll Tilted Grid turned on its side, with the tilt drawn as a curve.
 * One row of images streams from right to left around the inside of a
 * cylinder. The centre faces you flat, the ends bend toward you so each
 * end image curves along its length, and the ends fade into the page.
 *
 * A CSS box can't bend, so every tile is cut into SLICES vertical strips,
 * each a flat facet of the cylinder showing its share of the image. The
 * strips sit still inside their tile, each turned its own few degrees
 * round the cylinder's axis, and the tile (preserve-3d) is what moves: one
 * rotateY about that same axis carries the whole tile along the arc. A
 * tile is one animation, so its strips can never drift apart or show
 * different images. Only a tile's delay differs, and that sets where on
 * the arc it sits. The band is transform-only on the compositor; the fade
 * is a static mask over it.
 *
 * The only JS is a ResizeObserver that sizes the loop, and a handler that
 * hands a tile its next image each time it wraps, out of sight.
 * ─────────────────────────────────────────────────────────────── */

// 12 slices per tile produces an ultra-smooth cylindrical curvature with
// zero chord distortion, while maintaining 60 FPS compositor performance.
const SLICES = 12;

// Camera distance from the screen, as a multiple of the cylinder's radius.
// Just past the axis, so the ends come right up to the lens and swell; much
// further back and the row flattens out however tight the cylinder.
const CAMERA = 1.6;

/**
 * Cylinder radius, as a share of the hero's width, that puts the frame's
 * edge `bend` radians round the arc as seen through the camera:
 * r·sinθ · CAMERA / (CAMERA − 1 + cosθ) = width / 2, solved for r.
 */
function arc(bend: number) {
  return (CAMERA - 1 + Math.cos(bend)) / (2 * CAMERA * Math.sin(bend));
}

// A tile is never wider than this share of the hero, so a phone still
// shows its neighbours instead of one tile edge to edge.
const MAX_WIDTH = 55;

/**
 * Lays the loop on the cylinder. The radius puts the frame's edge `bend`
 * radians round the arc (see `arc`). Angles come back in degrees: `unit`
 * is the arc one tile-height spans, `limit` how far round a tile's centre
 * can go before the whole tile is off-screen, and `sweep` how far round
 * the loop's ends sit. The loop reaches past `limit`, so a tile only ever
 * wraps out of sight, and is rounded up to a whole number of tiles so the
 * gap never stretches.
 */
function measure(
  width: number,
  height: number,
  tile: number,
  aspect: number,
  gap: number,
  bend: number,
) {
  const h = Math.min(
    (tile / 100) * height,
    ((MAX_WIDTH / 100) * width) / aspect,
  );
  const radius = width * arc(bend);
  if (!(h > 0) || !(radius > 0))
    return { columns: 2, sweep: 0, unit: 0, limit: 0 };
  const deg = (rad: number) => (rad * 180) / Math.PI;
  const unit = deg(h / radius);
  const pitch = (aspect + gap / 100) * unit;
  const limit = deg(bend) + (aspect * unit) / 2;
  // Capped so a hero squeezed to a sliver can't mount thousands of tiles.
  const columns = Math.min(60, Math.max(2, Math.ceil((2 * limit) / pitch)));
  const round = (n: number) => +n.toFixed(4);
  const sweep = round((columns * pitch) / 2);
  return {
    columns,
    sweep,
    unit: round(unit),
    limit: round(Math.min(sweep, limit)),
  };
}

export type TiltedGridImage = {
  src: string;
  /** Only used if you drop the decorative treatment; the band is aria-hidden. */
  alt?: string;
  className?: string;
  sequence?: string;
  classId?: string;
  classNameTitle?: string;
  role?: string;
  bbox?: string;
  cam?: string;
  confidence?: string;
};

export type TiltedGridHeroProps = {
  /**
   * Images run along the row in order. A tile takes its next image each
   * time it wraps off-screen, so the whole list plays through however
   * few tiles the frame needs. Short lists simply repeat.
   */
  images: TiltedGridImage[];
  /**
   * Seconds for the row to advance by one tile. Speed is per tile, not per
   * crossing, so a phone and an ultrawide move at the same pace.
   * @default 4
   */
  speed?: number;
  /** Tile height, as a percentage of the hero's height. @default 32 */
  tileHeight?: number;
  /** Tile width divided by tile height. @default 16 / 9 */
  aspectRatio?: number;
  /** Space between tiles, as a percentage of a tile's height. @default 6 */
  gap?: number;
  /** Vertical centre of the row, as a percentage of the hero's height. @default 54 */
  axis?: number;
  /**
   * How far the row has bent round by the frame's edge, in degrees. Higher
   * curls the ends harder toward the viewer. Clamped to 5–85.
   * @default 80
   */
  curve?: number;
  /** Width of the fade at each end, as a percentage of the hero's width. @default 12 */
  fade?: number;
  /** Content rendered above the band. */
  children?: React.ReactNode;
  className?: string;
  pauseOnHover?: boolean;
  onTileClick?: (image: TiltedGridImage, index: number) => void;
};

export function TiltedGridHero({
  images,
  speed = 4,
  tileHeight = 32,
  aspectRatio = 16 / 9,
  gap = 6,
  axis = 54,
  curve = 80,
  fade = 12,
  children,
  className,
  pauseOnHover = true,
  onTileClick,
  ...props
}: React.ComponentProps<'div'> & TiltedGridHeroProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const orbit = `tgh-o-${id}`;
  const tile = `tgh-t-${id}`;
  const bend = (Math.min(85, Math.max(5, curve)) * Math.PI) / 180;

  // Track hover state directly in React to reliably pause animation
  const [isHovered, setIsHovered] = React.useState(false);

  // Null until the observer has measured the hero. The band stays hidden
  // until then, so a first paint laid out for the wrong size never shows.
  const [layout, setLayout] = React.useState<ReturnType<typeof measure> | null>(
    null,
  );

  // The image each tile shows, as a position in the run of images. It
  // only changes when the tile wraps, which is out of sight, so a resize
  // never swaps an image on screen either.
  const [shown, setShown] = React.useState<Record<number, number>>({});

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const next = measure(width, height, tileHeight, aspectRatio, gap, bend);
      setLayout((prev) =>
        prev?.columns === next.columns &&
        prev.sweep === next.sweep &&
        prev.unit === next.unit
          ? prev
          : next,
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [tileHeight, aspectRatio, gap, bend]);

  // Fetch every image up front. A tile picks up its next one just before
  // it comes back into view, too late to start loading it then.
  React.useEffect(() => {
    for (const { src } of images) {
      if (typeof window !== 'undefined') {
        const img = new Image();
        img.src = src;
      }
    }
  }, [images]);

  const { columns, sweep, unit, limit } =
    layout ?? measure(1200, 560, tileHeight, aspectRatio, gap, bend);

  // Every length is a multiple of the tile's height, which follows the
  // hero's height until MAX_WIDTH caps it on narrow screens.
  const u = (n: number) =>
    `calc(${+n.toFixed(4)} * min(${tileHeight}cqh, ${+(
      MAX_WIDTH / aspectRatio
    ).toFixed(4)}cqw))`;

  const r = 100 * arc(bend);
  const radius = `${+r.toFixed(3)}cqw`;
  // Out to the axis, round it, back in: a box sits on the cylinder at the
  // angle rotateY gives it.
  const turn = (deg: number) =>
    `translateZ(${radius}) rotateY(${+deg.toFixed(4)}deg) translateZ(-${radius})`;

  // Beyond `limit` a tile is wholly off-screen, so it is hidden there. The
  // loop's ends, where it wraps, fall inside that stretch, and so do tiles
  // swinging round behind the camera.
  const hide = +(((sweep - limit) / (2 * sweep || 1)) * 100).toFixed(4);
  const css =
    `@keyframes ${orbit}{` +
    `from{transform:${turn(-sweep)}}to{transform:${turn(sweep)}}` +
    `0%,${hide}%,${100 - hide}%,100%{visibility:hidden}` +
    `${hide + 0.001}%,${100 - hide - 0.001}%{visibility:visible}}` +
    `[data-tgh-tile="${id}"] { will-change: transform; backface-visibility: hidden; -webkit-backface-visibility: hidden; }` +
    (pauseOnHover ? `[data-tgh-container="${id}"]:hover [data-tgh-tile="${id}"], [data-tgh-tile="${id}"]:hover { animation-play-state: paused !important; }` : '') +
    `@media(prefers-reduced-motion:reduce){[data-tgh-tile="${id}"]{animation-play-state:paused !important;}}`;

  const share = aspectRatio / SLICES;
  const duration = columns * speed;
  const mask = `linear-gradient(90deg,transparent,#000 ${fade}%,#000 ${
    100 - fade
  }%,transparent)`;

  return (
    <div
      ref={ref}
      data-tgh-container={id}
      onMouseEnter={() => pauseOnHover && setIsHovered(true)}
      onMouseLeave={() => pauseOnHover && setIsHovered(false)}
      className={cn('tgh-container relative overflow-hidden pointer-events-auto', className)}
      {...props}
      style={{ containerType: 'size', contain: 'layout paint', ...props.style }}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div
        aria-hidden
        className="pointer-events-auto absolute inset-0 transition-opacity duration-500"
        style={{
          opacity: layout ? 1 : 0,
          perspective: `${+(r * CAMERA).toFixed(3)}cqw`,
          perspectiveOrigin: `50% ${axis}%`,
          maskImage: mask,
          WebkitMaskImage: mask,
          willChange: 'transform',
          transform: 'translateZ(0)',
        }}
      >
        {Array.from({ length: columns }, (_, t) => {
          const first = columns - 1 - t;
          const img = images[(shown[t] ?? first) % Math.max(images.length, 1)];
          return (
            <div
              key={t}
              data-tgh-tile={id}
              className={cn(tile, 'absolute cursor-pointer rounded-2xl bg-[#0A0D0C] border border-white/20 dark:border-white/10 shadow-2xl overflow-hidden')}
              style={{
                left: `calc(50% - ${u(aspectRatio / 2)})`,
                top: `calc(${axis}% - ${u(0.5)})`,
                width: u(aspectRatio),
                height: u(1),
                transformStyle: 'preserve-3d',
                animation: `${orbit} ${duration}s linear ${-t * speed}s infinite`,
                animationPlayState: pauseOnHover && isHovered ? 'paused' : 'running',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
              onClick={() => {
                if (img && onTileClick) {
                  onTileClick(img, (shown[t] ?? first) % Math.max(images.length, 1));
                }
              }}
              onAnimationIteration={(e) => {
                const lap = Math.round(e.elapsedTime / duration);
                setShown((prev) => {
                  const next = lap * columns + first;
                  return prev[t] === next ? prev : { ...prev, [t]: next };
                });
              }}
            >
              {Array.from({ length: SLICES }, (_, k) => (
                <div
                  key={k}
                  className={cn(
                    'absolute top-0 overflow-hidden bg-[#0A0D0C]',
                    k === 0 && 'rounded-l-2xl',
                    k === SLICES - 1 && 'rounded-r-2xl',
                  )}
                  style={{
                    left: u((aspectRatio - share) / 2),
                    width:
                      k === SLICES - 1 ? `calc(${u(share)} + 1px)` : `calc(${u(share)} + 3px)`,
                    height: u(1),
                    transform: turn(
                      (aspectRatio / 2 - (k + 0.5) * share) * unit,
                    ),
                    willChange: 'transform',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    outline: '1px solid transparent',
                  }}
                >
                  {img ? (
                    <div
                      className="absolute top-0 pointer-events-none select-none overflow-hidden"
                      style={{
                        left: u(-k * share),
                        width: u(aspectRatio),
                        height: u(1),
                      }}
                    >
                      {/* 1. Vehicle Telemetry Image */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.src}
                        alt={k === 0 ? (img.alt ?? '') : ''}
                        loading="eager"
                        decoding="async"
                        draggable={false}
                        className={cn(
                          'absolute inset-0 w-full h-full object-cover brightness-[0.92] contrast-[1.05]',
                          img.className,
                        )}
                      />

                      {/* 2. Optical Sensor Telemetry Vignette */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-black/65 pointer-events-none" />

                      {/* 3. Top HUD Bar */}
                      <div className="absolute top-3 inset-x-3 flex items-center justify-between">
                        {/* Class Identification Badge */}
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0A0E0C]/90 border border-emerald-500/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
                          <span className="text-[11px] font-mono font-bold tracking-wider text-emerald-300">
                            CLASS: {img.classId?.toUpperCase() || 'VEHICLE'}
                          </span>
                          {img.sequence && (
                            <span className="text-[10px] font-mono text-emerald-500/90 font-medium">
                              //{img.sequence}
                            </span>
                          )}
                        </div>

                        {/* Status / Confidence Pill */}
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#0A0E0C]/85 border border-white/15">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span className="text-[10px] font-mono text-zinc-300 font-semibold">
                            {img.confidence || '99.2%'}
                          </span>
                        </div>
                      </div>

                      {/* 4. Target Bounding Box Reticles (HUD Viewfinder) */}
                      <div className="absolute inset-[16%] pointer-events-none">
                        {/* 4 Emerald Corner L-Brackets */}
                        <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-emerald-400 shadow-[0_0_8px_#10b981]" />
                        <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-emerald-400 shadow-[0_0_8px_#10b981]" />
                        <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-emerald-400 shadow-[0_0_8px_#10b981]" />
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-emerald-400 shadow-[0_0_8px_#10b981]" />

                        {/* Center Optical Crosshair */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 opacity-40">
                          <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-emerald-400" />
                          <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-emerald-400" />
                        </div>

                        {/* Clamped Bounding Box Coordinates */}
                        {img.bbox && (
                          <div className="absolute bottom-1 right-1 text-[9px] font-mono text-emerald-300/90 bg-[#0A0E0C]/90 px-1.5 py-0.5 rounded border border-emerald-500/30">
                            {img.bbox}
                          </div>
                        )}
                      </div>

                      {/* 5. Bottom Card Metadata Scrim */}
                      <div className="absolute bottom-0 inset-x-0 p-3.5 space-y-1 bg-gradient-to-t from-black/95 via-black/80 to-transparent">
                        <div className="text-sm font-bold text-white tracking-tight drop-shadow-md">
                          {img.classNameTitle || img.alt}
                        </div>
                        {img.role && (
                          <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400/90 font-medium line-clamp-1 drop-shadow-sm">
                            {img.role}
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-1 text-[9px] font-mono text-zinc-400 border-t border-white/10">
                          <span className="text-emerald-400 font-semibold">{img.cam || 'CAM-01'}</span>
                          <span className="inline-flex items-center gap-1 text-zinc-300">
                            <span className="w-1 h-1 rounded-full bg-emerald-400" />
                            CALIBRATED
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {children}
    </div>
  );
}

export default TiltedGridHero;
