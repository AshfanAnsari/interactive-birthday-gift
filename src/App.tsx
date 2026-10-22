import { useEffect, useRef, useState } from 'react';

const HEART = 'M50 84 C20 62 6 44 6 28 C6 13 17 5 29 5 C40 5 47 11 50 19 C53 11 60 5 71 5 C83 5 94 13 94 28 C94 44 80 62 50 84 Z';
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function Gloss() {
  return (
    <>
      <ellipse cx="-14" cy="-18" rx="13" ry="7.5" fill="#fff" opacity=".55" transform="rotate(-24)" />
      <ellipse cx="-19" cy="-22" rx="6" ry="3.4" fill="#fff" opacity=".85" transform="rotate(-24)" />
    </>
  );
}

/* ── Scene 1 · pull & release the heart ────────────────────────────────────── */
const SPARKS = [
  [-70, -90, '#f472b6', 5], [-30, -120, '#f5c518', 4], [15, -130, '#f472b6', 6], [60, -105, '#ec4899', 4],
  [95, -60, '#f5c518', 5], [-105, -40, '#ec4899', 4], [110, -15, '#f472b6', 4], [-95, 5, '#f5c518', 3.5],
  [40, -80, '#fff', 3.5], [-50, -60, '#fff', 3], [80, -30, '#fff', 3], [0, -95, '#f9a8d4', 4.5],
] as const;

function HeartScene({ launching, onLaunch }: { launching: boolean; onLaunch: () => void }) {
  const [pull, setPull] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const touched = useRef(false);
  const autoTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (launching) return;
    autoTimer.current = window.setTimeout(onLaunch, 6500);
    return () => window.clearTimeout(autoTimer.current);
  }, [launching, onLaunch]);

  const toLocal = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const pt = new DOMPoint(e.clientX, e.clientY);
    return pt.matrixTransform(svg.getScreenCTM()!.inverse());
  };
  const down = (e: React.PointerEvent) => {
    if (launching) return;
    touched.current = true;
    window.clearTimeout(autoTimer.current);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toLocal(e);
    drag.current = { dx: p.x - pull.x, dy: p.y - pull.y };
  };
  const move = (e: React.PointerEvent) => {
    if (!drag.current || launching) return;
    const p = toLocal(e);
    setPull({ x: clamp(p.x - drag.current.dx, -70, 70), y: clamp(p.y - drag.current.dy, -36, 145) });
  };
  const up = () => {
    if (!drag.current) return;
    drag.current = null;
    if (pull.y > 62) { onLaunch(); return; }
    setPull({ x: 0, y: 0 });
    window.clearTimeout(autoTimer.current);
    autoTimer.current = window.setTimeout(onLaunch, 5000);
  };

  const hx = 340 + pull.x, hy = 158 + pull.y;
  return (
    <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 100% at 50% 38%, #fffdf9 0%, #fff9f3 55%, #f6e7da 100%)' }}>
      <p className="text-fade absolute left-0 right-0 top-[8.5%] text-center font-serifit text-[19px] font-semibold italic tracking-[0.02em] text-[#8a7168]" style={{ opacity: launching ? 0 : 1 }}>
        a little something for you
      </p>
      <div className="absolute inset-0 flex items-center justify-center">
        <svg ref={svgRef} viewBox="0 0 560 400" className="mt-[1vh] w-[min(600px,94vw)]" role="img" aria-label="A pink heart on a slingshot. Pull it down and release.">
          <defs>
            <radialGradient id="heartGrad" cx="35%" cy="24%" r="85%">
              <stop offset="0%" stopColor="#ffd9ec" /><stop offset="38%" stopColor="#faa3cd" />
              <stop offset="68%" stopColor="#f472b6" /><stop offset="100%" stopColor="#ec4899" />
            </radialGradient>
            <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f9a8d4" stopOpacity=".5" /><stop offset="100%" stopColor="#f9a8d4" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* slingshot */}
          <g fill="none" stroke="#8d6e63" strokeWidth="5.5" strokeLinecap="round">
            <path d="M150 372 C148 322 146 288 138 252" />
            <path d="M138 252 C131 226 122 208 108 194" />
            <path d="M138 252 C147 228 158 212 174 202" />
          </g>
          <line x1="108" y1="194" x2="141" y2="238" stroke="#97766a" strokeWidth="3.5" />
          <line x1="174" y1="202" x2="141" y2="238" stroke="#97766a" strokeWidth="3.5" />
          <g transform="translate(141 240) scale(0.17)"><path d={HEART} transform="translate(-50 -46)" fill="#e91e63" /></g>

          {/* the heart */}
          <g style={{ transform: `translate(${pull.x}px, ${pull.y}px)`, transition: drag.current ? 'none' : 'transform .45s cubic-bezier(.34,1.56,.64,1)' }}>
            <g className={launching ? 'fly-heart' : undefined} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
              <circle cx="340" cy="158" r="128" fill="url(#glowGrad)" />
              <g className="pulse-heart" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
                style={{ cursor: launching ? 'default' : 'grab', touchAction: 'none' }}>
                <g transform="translate(340 158) scale(1.62)">
                  <path d={HEART} transform="translate(-50 -46)" fill="url(#heartGrad)" />
                  <Gloss />
                </g>
              </g>
            </g>
          </g>

          {/* sparkles on launch */}
          {launching && SPARKS.map(([dx, dy, c, r], i) => (
            <circle key={i} className="sparkle" cx={hx} cy={hy - 20} r={r} fill={c}
              style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, animationDelay: `${i * 0.03}s` } as React.CSSProperties} />
          ))}
        </svg>
      </div>
      <p className="text-fade absolute bottom-[8%] left-0 right-0 text-center font-sans text-[11px] font-semibold tracking-[0.38em] text-[#8a7168]" style={{ opacity: launching ? 0 : 1, paddingLeft: '0.38em' }}>
        PULL &amp; RELEASE
      </p>
    </div>
  );
}

/* ── Scene 2 · the heart tree ──────────────────────────────────────────────── */
const BRANCHES: [string, number, number, number][] = [
  // path, strokeWidth, delay, duration
  ['M338 548 C335 478 331 418 327 354 C325 320 323 292 319 262', 8.5, 0.15, 1.7],
  ['M326 336 C290 310 254 298 212 300', 4.2, 1.2, 1.2],
  ['M328 326 C364 302 402 290 444 294', 4.2, 1.35, 1.2],
  ['M321 302 C292 264 252 242 204 234', 4.2, 1.5, 1.3],
  ['M323 284 C351 246 390 226 432 220', 4.2, 1.65, 1.3],
  ['M320 268 C301 224 274 196 240 178', 4, 1.8, 1.2],
  ['M322 262 C345 216 374 190 408 172', 4, 1.95, 1.2],
  ['M319 252 C313 206 317 168 307 136', 3.6, 2.1, 1.2],
  ['M204 234 C182 226 166 208 158 188', 2.2, 2.5, 0.9],
  ['M432 220 C456 212 469 197 477 179', 2.2, 2.6, 0.9],
  ['M240 178 C228 158 228 139 235 120', 2.2, 2.7, 0.9],
  ['M408 172 C420 151 437 141 456 137', 2.2, 2.8, 0.9],
  ['M307 136 C301 116 304 97 313 80', 2.2, 2.9, 0.9],
  ['M212 300 C188 296 170 284 160 266', 2.2, 2.45, 0.9],
  ['M444 294 C468 290 484 278 494 260', 2.2, 2.55, 0.9],
];
const BLOOMS: [number, number, number, string, number][] = [
  [252, 252, 30, '#f06292', 3.15], [302, 214, 38, '#e91e63', 3.35], [362, 238, 32, '#f472b6', 3.55],
  [412, 208, 26, '#ef5350', 3.75], [214, 278, 24, '#ec407a', 3.9], [332, 278, 28, '#f06292', 4.05],
  [388, 272, 22, '#e91e63', 4.2], [272, 302, 20, '#f472b6', 4.35], [352, 182, 22, '#ef5350', 4.5],
  [300, 158, 18, '#e91e63', 4.62], [424, 258, 18, '#f06292', 4.74], [238, 206, 18, '#ec407a', 4.86],
  [378, 152, 16, '#f472b6', 4.98], [204, 238, 16, '#e91e63', 5.1], [448, 236, 16, '#ef5350', 5.22],
  [306, 306, 17, '#ec407a', 5.34], [352, 312, 15, '#f06292', 5.44], [282, 268, 15, '#ef5350', 5.54],
];
const FLOATERS: [number, number, number, string, number][] = [
  [88, 296, 15, '#f48fb1', 4.6], [128, 238, 12, '#f06292', 5.0], [64, 196, 11, '#ec407a', 5.4],
];

function TreeScene() {
  const FULL = 'Happy Birthday';
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    let iv: number | undefined;
    const start = window.setTimeout(() => {
      iv = window.setInterval(() => setTyped((t) => {
        if (t >= FULL.length) { window.clearInterval(iv); return t; }
        return t + 1;
      }), 95);
    }, 5000);
    return () => { window.clearTimeout(start); window.clearInterval(iv); };
  }, []);
  return (
    <div className="fade-soft absolute inset-0" style={{ background: 'radial-gradient(90% 75% at 50% 60%, #fff8ec 0%, #ffe9c9 45%, #ffd9b3 100%)' }}>
      <svg viewBox="0 0 640 540" preserveAspectRatio="xMidYMax meet" className="absolute inset-0 h-full w-full" role="img" aria-label="A tree blooming with hearts">
        <ellipse cx="338" cy="536" rx="110" ry="10" fill="#eec39a" opacity=".55" className="fade-soft" style={{ animationDelay: '.3s' }} />
        <g fill="none" stroke="#5d4037" strokeLinecap="round">
          {BRANCHES.map(([d, w, delay, dur], i) => (
            <path key={i} d={d} strokeWidth={w} pathLength={100} className="draw" style={{ animationDelay: `${delay}s`, animationDuration: `${dur}s` }} />
          ))}
        </g>
        {BLOOMS.map(([x, y, s, c, delay], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${s / 100})`}>
            <g className="bloom" style={{ animationDelay: `${delay}s` }}>
              <path d={HEART} transform="translate(-50 -46)" fill={c} /><Gloss />
            </g>
          </g>
        ))}
        {FLOATERS.map(([x, y, s, c, delay], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${s / 100})`}>
            <g className="floaty" style={{ animationDelay: `${delay}s, ${delay}s` }}>
              <path d={HEART} transform="translate(-50 -46)" fill={c} />
            </g>
          </g>
        ))}
      </svg>
      <div className="absolute" style={{ left: '5.5%', bottom: '10%', maxWidth: '46%' }}>
        <p className="fade-soft font-serifit text-[15px] font-semibold italic text-[#8a7168]" style={{ animationDelay: '4.6s' }}>and... make it count</p>
        <p className="font-script leading-[1.05] text-[#c2185b]" style={{ fontSize: 'clamp(38px, 6.2vw, 64px)', minHeight: '1.05em' }}>
          {FULL.slice(0, typed)}
        </p>
      </div>
    </div>
  );
}

/* ── Scene 3 · the magenta card ────────────────────────────────────────────── */
function CardScene({ onDone }: { onDone: () => void }) {
  const FULL = 'Happy Birthday';
  const [n, setN] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const timers: number[] = [];
    let iv: number | undefined;
    const later = (fn: () => void, ms: number) => { timers.push(window.setTimeout(fn, ms)); };
    later(() => {
      iv = window.setInterval(() => setN((v) => {
        if (v >= FULL.length) {
          window.clearInterval(iv);
          later(() => {
            iv = window.setInterval(() => setN((w) => {
              if (w <= 0) { window.clearInterval(iv); later(() => done.current(), 500); return 0; }
              return w - 1;
            }), 55);
          }, 3400);
          return v;
        }
        return v + 1;
      }), 105);
    }, 800);
    return () => { timers.forEach(clearTimeout); window.clearInterval(iv); };
  }, []);
  const full = n >= FULL.length;
  return (
    <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 32% 42%, #fb7185 0%, #f43f5e 34%, #be185d 68%, #9d174d 100%)' }}>
      <div className="bar-top absolute left-0 right-0 top-0 z-[3] h-[16vh] bg-[#12040b]" />
      <div className="bar-bot absolute bottom-0 left-0 right-0 z-[3] h-[16vh] bg-[#12040b]" />
      <p className="fade-soft absolute left-0 right-0 z-[2] text-center font-script text-[24px] text-[#ffe4e6]/90" style={{ top: 'calc(16vh + 24px)', animationDelay: '.55s' }}>
        make a wish...
      </p>
      <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center">
        <h1 className="font-display text-center font-bold text-white" style={{ fontSize: 'clamp(46px, 9vw, 104px)', minHeight: '1.15em', textShadow: '0 6px 30px rgba(80,7,36,.35)' }}>
          {FULL.slice(0, n)}
        </h1>
        <svg viewBox="0 0 430 26" className="mt-1 w-[min(430px,62vw)]" aria-hidden>
          {full && <path d="M8 16 C110 4 260 26 422 10" fill="none" stroke="#f5c518" strokeWidth="5" strokeLinecap="round" pathLength={100} className="swoosh" />}
        </svg>
      </div>
      {full && (
        <p className="fade-soft absolute bottom-0 left-0 right-0 z-[2] text-center font-script text-[24px] text-[#ffe4e6]/90" style={{ bottom: 'calc(16vh + 24px)' }}>
          to someone worth celebrating
        </p>
      )}
    </div>
  );
}

/* ── The loop ──────────────────────────────────────────────────────────────── */
export default function App() {
  const [phase, setPhase] = useState<'heart' | 'launch' | 'tree' | 'card'>('heart');
  useEffect(() => {
    if (phase === 'launch') { const t = setTimeout(() => setPhase('tree'), 1000); return () => clearTimeout(t); }
    if (phase === 'tree') { const t = setTimeout(() => setPhase('card'), 11800); return () => clearTimeout(t); }
  }, [phase]);
  return (
    <main className="relative h-full w-full select-none overflow-hidden">
      {(phase === 'heart' || phase === 'launch') && (
        <HeartScene launching={phase === 'launch'} onLaunch={() => setPhase('launch')} />
      )}
      {phase === 'tree' && <TreeScene />}
      {phase === 'card' && <CardScene onDone={() => setPhase('heart')} />}
    </main>
  );
}
