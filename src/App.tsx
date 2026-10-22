import { useEffect, useRef, useState } from 'react';

/**
 * Interactive Birthday Gift — frame-accurate replica of the @code_wars_official reel.
 * Spec measured from the reel's own frames (see ../ref/):
 *  Scene 1 · cream room, glossy heart (62% x, 40% y) with a pink halo, cupid bow at
 *            lower-left; an arrow shoots, bursts into mini-hearts, then a raspberry
 *            circle wipes the screen.
 *  Scene 2 · magenta card: black bars (16vh), serif-italic "make a wish...", the title
 *            types on TWO lines centered ~58% across, double gold swoosh,
 *            "to someone worth celebrating", then reverse-types away.
 *  Scene 3 · peach tree scene: thick plum trunk at 66%, forked branches, a canopy of
 *            100+ tiny hearts forming one big heart; the .wish text block at
 *            left:5.5% / bottom:10% — "and... make it count" / "Happy Birthday" /
 *            "here's to a year that blooms". Loops back to Scene 1.
 */

const HEART = 'M50 88 C20 62 4 44 4 27 C4 11 16 2 28 2 C39 2 47 8 50 16 C53 8 61 2 72 2 C84 2 96 11 96 27 C96 44 80 62 50 88 Z';
const FULL = 'Happy Birthday';

function Gloss() {
  return (
    <>
      <ellipse cx="33" cy="29" rx="11" ry="7" fill="#ffffff" opacity=".85" transform="rotate(-18 33 29)" />
      <ellipse cx="56" cy="17" rx="4.5" ry="2.8" fill="#ffffff" opacity=".45" transform="rotate(-14 56 17)" />
    </>
  );
}

/* ── deterministic pseudo-random for the canopy ─────────────────────────── */
function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const BLOOM_COLORS = ['#f06292', '#f06292', '#ec407a', '#ec407a', '#ef5350', '#f48fb1', '#f8bbd0', '#ffab40', '#ffb74d', '#fff3e0'];
type Bloom = { x: number; y: number; s: number; c: number; d: number; r: number };
const CANOPY: Bloom[] = (() => {
  const rand = mulberry(20261022);
  const pts: Bloom[] = [];
  const place = (t: number, s: number) => {
    const hx = 16 * Math.pow(Math.sin(t), 3) * s;
    const hy = 2 + (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) - 2) * s;
    const x = 648 + hx * 13.8 + (rand() - 0.5) * 14;
    const y = 208 - hy * 13.8 + (rand() - 0.5) * 12;
    const dist = Math.hypot(x - 634, y - 385);
    pts.push({
      x, y,
      s: 16 + rand() * 18,
      c: Math.floor(rand() * BLOOM_COLORS.length),
      d: 2.35 + (dist / 520) * 1.8 + rand() * 0.3,
      r: (rand() - 0.5) * 24,
    });
  };
  // crisp boundary ring, like the reference's readable heart silhouette
  for (let i = 0; i < 78; i++) place((i / 78) * Math.PI * 2 + rand() * 0.05, 0.97 + rand() * 0.05);
  // filled interior
  let guard = 0;
  while (pts.length < 235 && guard++ < 6000) {
    place(rand() * Math.PI * 2, 0.12 + 0.83 * Math.pow(rand(), 0.4));
  }
  return pts;
})();

/* ══ Scene 1 · the heart and the bow ══════════════════════════════════════ */
type ShotPhase = 'play' | 'burst' | 'wipe';

const BURST: Array<[number, number, string, number, boolean]> = [
  // dx, dy, color, size, isHeart
  [-46, -52, '#f06292', 13, true], [-18, -68, '#f5c518', 5, false], [14, -62, '#ec407a', 11, true],
  [44, -44, '#f5c518', 6, false], [58, -12, '#f48fb1', 10, true], [-62, -16, '#ef5350', 10, true],
  [30, -78, '#ffb74d', 5, false], [-34, -84, '#f8bbd0', 9, true], [66, -58, '#f06292', 8, true],
];

const BOW_TIP_TOP = { x: 244, y: 328 };
const BOW_TIP_BOT = { x: 218, y: 476 };
const NOCK0 = { x: 238, y: 400 };
const BASE_ANGLE = -33;
const HEART_C = { x: 595, y: 215 };
const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function ArrowShape() {
  return (
    <g>
      <line x1="-6" y1="0" x2="72" y2="0" stroke="#4e342e" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M2 0 L-10 -7 L-4 0 L-10 7 Z" fill="#e53935" />
      <path d="M8 0 L-2 -8 L3 0 L-2 8 Z" fill="#ef5350" opacity=".85" />
      <circle cx="34" cy="0" r="4.2" fill="none" stroke="#37474f" strokeWidth="1.8" />
      <path d="M72 0 L60 -3.6 L60 3.6 Z" fill="#f5c518" />
      <circle cx="73" cy="0" r="3.4" fill="#f5c518" />
    </g>
  );
}

function HeartScene({ phase, onHit }: { phase: ShotPhase; onHit: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [aim, setAim] = useState<{ pull: number; theta: number } | null>(null);
  const [flight, setFlight] = useState<{ nockX: number; nockY: number; theta: number; dist: number; dur: number; hit: boolean } | null>(null);
  const [arrowGone, setArrowGone] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const interacted = useRef(false);
  const autoTimer = useRef<number | undefined>(undefined);

  const fire = (theta: number, pull: number) => {
    const rad = (theta * Math.PI) / 180;
    const u = { x: Math.cos(rad), y: Math.sin(rad) };
    const nock = flight ? { x: flight.nockX, y: flight.nockY } : { x: NOCK0.x - u.x * pull, y: NOCK0.y - u.y * pull };
    const t = (HEART_C.x - nock.x) * u.x + (HEART_C.y - nock.y) * u.y;
    const cx = nock.x + u.x * t, cy = nock.y + u.y * t;
    const d = Math.hypot(HEART_C.x - cx, HEART_C.y - cy);
    const hit = d < 95 && t > 0;
    const dist = hit ? Math.max(60, t - 100) : 780;
    const dur = clampN(dist / 1500, 0.26, 0.58);
    setAim(null);
    setFlight({ nockX: nock.x, nockY: nock.y, theta, dist, dur, hit });
    window.setTimeout(() => {
      if (hit) { onHit(); return; }
      setArrowGone(true);
      window.setTimeout(() => { setFlight(null); setArrowGone(false); }, 320);
    }, dur * 1000 + 30);
  };

  useEffect(() => {
    if (phase !== 'play') return;
    autoTimer.current = window.setTimeout(() => {
      if (!interacted.current) fire(BASE_ANGLE, 46);
    }, 6500);
    return () => window.clearTimeout(autoTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const toLocal = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const pt = new DOMPoint(e.clientX, e.clientY);
    return pt.matrixTransform(svg.getScreenCTM()!.inverse());
  };
  const down = (e: React.PointerEvent) => {
    if (phase !== 'play' || flight) return;
    interacted.current = true;
    window.clearTimeout(autoTimer.current);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const p = toLocal(e);
    drag.current = { x: p.x, y: p.y };
    setAim({ pull: 0, theta: BASE_ANGLE });
  };
  const move = (e: React.PointerEvent) => {
    if (!drag.current || flight) return;
    const p = toLocal(e);
    const dx = p.x - drag.current.x, dy = p.y - drag.current.y;
    const rad = (BASE_ANGLE * Math.PI) / 180;
    const u = { x: Math.cos(rad), y: Math.sin(rad) };
    const perp = { x: -u.y, y: u.x };
    const pull = clampN(-(dx * u.x + dy * u.y), 0, 74);
    const theta = BASE_ANGLE + clampN((dx * perp.x + dy * perp.y) * 0.1, -16, 12);
    setAim({ pull, theta });
  };
  const up = () => {
    if (!drag.current) return;
    drag.current = null;
    if (aim && aim.pull >= 16) { fire(aim.theta, aim.pull); return; }
    setAim(null);
  };

  const theta = flight ? flight.theta : aim ? aim.theta : BASE_ANGLE;
  const pull = flight ? 0 : aim ? aim.pull : 0;
  const rad = (theta * Math.PI) / 180;
  const u = { x: Math.cos(rad), y: Math.sin(rad) };
  const nock = flight ? { x: flight.nockX, y: flight.nockY } : { x: NOCK0.x - u.x * pull, y: NOCK0.y - u.y * pull };
  const textsGone = phase !== 'play' || !!flight;

  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#fffcf7 0%,#fff6ec 55%,#fdeeda 100%)' }}>
      <p className="text-fade absolute font-serifit italic font-semibold"
        style={{ left: '49.5%', top: '19%', fontSize: 'clamp(15px,2vw,21px)', color: '#b26e82', opacity: textsGone ? 0 : 1 }}>
        a little something, for you
      </p>
      <p className="text-fade absolute left-1/2 -translate-x-1/2 font-serifit font-semibold"
        style={{ bottom: '4.2%', fontSize: 12.5, letterSpacing: '.34em', color: '#9c7a72', opacity: textsGone ? 0 : 1 }}>
        PULL &amp; RELEASE
      </p>

      <svg ref={svgRef} viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" role="img" aria-label="A glossy pink heart and a cupid bow. Pull the arrow back and release to shoot.">
        <defs>
          <radialGradient id="heartGrad" cx="38%" cy="26%" r="85%">
            <stop offset="0%" stopColor="#ffd9ec" />
            <stop offset="34%" stopColor="#ff9ec4" />
            <stop offset="68%" stopColor="#fb6f9e" />
            <stop offset="100%" stopColor="#ef4d84" />
          </radialGradient>
          <radialGradient id="haloGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f78fb0" stopOpacity=".5" />
            <stop offset="55%" stopColor="#f78fb0" stopOpacity=".28" />
            <stop offset="100%" stopColor="#f78fb0" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* halo + heart */}
        <circle cx="595" cy="215" r="158" fill="url(#haloGrad)" />
        <g className={phase === 'burst' ? 'hit-pop' : undefined} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          <g className="pulse-heart">
            <g transform="translate(595 215) scale(1.5)">
              <g transform="translate(-50 -46)">
                <path d={HEART} fill="url(#heartGrad)" />
                <Gloss />
              </g>
            </g>
          </g>
        </g>

        {/* burst of mini hearts + gold dots on the hit */}
        {phase === 'burst' && BURST.map(([dx, dy, c, sz, isHeart], i) =>
          isHeart ? (
            <g key={i} className="sparkle" style={{ ['--dx' as string]: `${dx}px`, ['--dy' as string]: `${dy}px` }}>
              <path d={HEART} transform={`translate(${520 + dx * 0.15 - sz / 2} ${196 + dy * 0.15 - sz / 2}) scale(${sz / 100})`} fill={c} />
            </g>
          ) : (
            <circle key={i} className="sparkle" cx={520} cy={196} r={sz / 1.6} fill={c}
              style={{ ['--dx' as string]: `${dx}px`, ['--dy' as string]: `${dy}px` }} />
          ),
        )}

        {/* the bow — slender recurve, string on the target side */}
        <g transform="translate(230 400) rotate(12)">
          <path d="M-4 -78 C-17 -44 -19 -8 -14 22 C-10 46 -5 62 3 78" fill="none" stroke="#5d4037" strokeWidth="4.6" strokeLinecap="round" />
          <line x1="-14" y1="-4" x2="-9" y2="16" stroke="#3e2723" strokeWidth="6.5" strokeLinecap="round" />
        </g>
        {/* the string: straight at rest, bent to the nock while aiming */}
        {aim ? (
          <polyline points={`${BOW_TIP_TOP.x},${BOW_TIP_TOP.y} ${nock.x},${nock.y} ${BOW_TIP_BOT.x},${BOW_TIP_BOT.y}`}
            fill="none" stroke="#9a8a84" strokeWidth="1.5" />
        ) : (
          <line x1={BOW_TIP_TOP.x} y1={BOW_TIP_TOP.y} x2={BOW_TIP_BOT.x} y2={BOW_TIP_BOT.y} stroke="#9a8a84" strokeWidth="1.5" />
        )}

        {/* the arrow */}
        {!arrowGone && (
          <g transform={`translate(${nock.x} ${nock.y}) rotate(${theta})`}>
            <g className={flight ? undefined : aim ? undefined : 'nudge'}
              style={flight ? { transform: `translateX(${flight.dist}px)`, opacity: flight.hit ? 0 : undefined, transition: `transform ${flight.dur}s ease-in, opacity .18s ease ${flight.dur - 0.12}s` } : undefined}>
              <ArrowShape />
            </g>
          </g>
        )}

        {/* generous grab area over the bow */}
        {phase === 'play' && !flight && (
          <rect x="105" y="285" width="290" height="245" fill="transparent"
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            style={{ cursor: 'grab', touchAction: 'none' }} />
        )}
      </svg>

      {/* the raspberry circle wipe */}
      {phase === 'wipe' && (
        <div className="wipe-circle absolute rounded-full"
          style={{ left: '62%', top: '40%', width: 44, height: 44, background: 'radial-gradient(circle at 42% 40%, #f0658f, #df2a63 78%)' }} />
      )}
    </div>
  );
}

/* ══ Scene 2 · the magenta card ═══════════════════════════════════════════ */
function CardScene({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    const timers: number[] = [];
    timers.push(window.setTimeout(() => {
      let i = 0;
      const iv = window.setInterval(() => {
        i += 1; setN(i);
        if (i >= FULL.length) {
          window.clearInterval(iv);
          timers.push(window.setTimeout(() => setDeleting(true), 1500));
        }
      }, 90);
      timers.push(iv as unknown as number);
    }, 650));
    return () => timers.forEach((t) => { window.clearTimeout(t); window.clearInterval(t); });
  }, []);

  useEffect(() => {
    if (!deleting) return;
    const iv = window.setInterval(() => {
      setN((v) => {
        if (v <= 1) {
          window.clearInterval(iv);
          if (!done.current) { done.current = true; window.setTimeout(onDone, 380); }
          return 0;
        }
        return v - 1;
      });
    }, 42);
    return () => window.clearInterval(iv);
  }, [deleting, onDone]);

  const typed = FULL.slice(0, n);
  const line1 = typed.slice(0, 5);
  const line2 = typed.slice(5).trimStart();
  const complete = n >= FULL.length && !deleting;

  return (
    <div className="absolute inset-0 overflow-hidden"
      style={{ background: 'radial-gradient(115% 95% at 30% 38%, #f78fb0 0%, #f0437a 38%, #d81b60 72%, #ad1457 100%)' }}>
      <div className="bar-top absolute left-0 right-0 top-0 z-[3] h-[16vh]" style={{ background: '#12040b' }} />
      <div className="bar-bot absolute bottom-0 left-0 right-0 z-[3] h-[16vh]" style={{ background: '#12040b' }} />

      <div className="absolute z-[2] w-full" style={{ left: '58%', top: '50%', transform: 'translate(-50%,-50%)' }}>
        <p className="fade-soft text-center font-serifit text-[19px] font-semibold italic" style={{ color: '#ffd7e0', animationDelay: '.25s' }}>
          make a wish...
        </p>
        <h1 className="mt-3 text-center font-display font-extrabold leading-[1.04] text-white"
          style={{ fontSize: 'clamp(54px,12.5vw,130px)', textShadow: '0 3px 14px rgba(90,0,40,.35)' }}>
          <span className="block min-h-[1.04em]">{line1}</span>
          <span className="block min-h-[1.04em]">{line2}</span>
        </h1>
        <svg viewBox="0 0 460 30" className="mx-auto mt-4 w-[min(430px,60vw)]" aria-hidden="true">
          <path d="M6 11 C 150 3, 320 5, 452 13" fill="none" stroke="#f5c518" strokeWidth="4.5" strokeLinecap="round"
            pathLength={100} className={complete ? 'swoosh' : undefined} style={{ strokeDasharray: 100, strokeDashoffset: complete ? undefined : 100 }} />
          <path d="M118 23 C 220 17, 330 17, 428 21" fill="none" stroke="#f5c518" strokeWidth="4" strokeLinecap="round"
            pathLength={100} className={complete ? 'swoosh' : undefined} style={{ strokeDasharray: 100, strokeDashoffset: complete ? undefined : 100, animationDelay: '.18s' }} />
        </svg>
      </div>

      <p className="absolute left-1/2 z-[2] -translate-x-1/2 text-center font-serifit text-[18px] font-semibold italic"
        style={{ bottom: 'calc(16vh + 20px)', color: '#ffd7e0', opacity: complete ? 1 : 0, transition: 'opacity .6s ease' }}>
        to someone worth celebrating
      </p>
    </div>
  );
}

/* ══ Scene 3 · the heart tree ═════════════════════════════════════════════ */
const BRANCHES: Array<[string, number, number]> = [
  // path, stroke width, grow delay (s)
  ['M636 545 C637 480 636 425 633 368', 15, 0.05],
  ['M633 372 C610 320 575 285 528 262', 8, 1.15],
  ['M634 366 C640 315 652 275 678 238', 8, 1.3],
  ['M635 370 C668 322 706 292 752 272', 8, 1.45],
  ['M632 380 C600 345 560 322 512 312', 5.5, 1.6],
  ['M636 378 C672 348 716 330 762 326', 5.5, 1.75],
  ['M528 262 C506 240 488 226 462 216', 3.2, 2.05],
  ['M528 262 C520 236 520 214 528 192', 3.2, 2.15],
  ['M678 238 C672 210 674 186 686 162', 3.2, 2.25],
  ['M678 238 C696 216 714 204 736 198', 3.2, 2.35],
  ['M752 272 C776 254 796 244 820 240', 3.2, 2.45],
  ['M752 272 C762 246 764 224 758 202', 3.2, 2.55],
  ['M512 312 C486 300 464 296 440 298', 3, 2.6],
  ['M762 326 C788 318 810 316 834 322', 3, 2.65],
];
const FLOATERS: Array<[number, number, number, string, number]> = [
  [110, 150, 11, '#f6a8c1', 0], [170, 330, 9, '#f6a8c1', 1.2], [88, 438, 10, '#ffd98a', 0.6],
  [258, 108, 8, '#f6a8c1', 1.8], [872, 462, 9, '#ffd98a', 0.9], [470, 128, 8, '#f6a8c1', 1.5], [566, 472, 10, '#f6a8c1', 0.3],
];

function TreeScene() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let iv: number | undefined;
    const start = window.setTimeout(() => {
      let i = 0;
      iv = window.setInterval(() => {
        i += 1; setN(i);
        if (i >= FULL.length) window.clearInterval(iv);
      }, 78);
    }, 2900);
    return () => { window.clearTimeout(start); if (iv) window.clearInterval(iv); };
  }, []);

  return (
    <div className="fade-soft absolute inset-0"
      style={{ background: 'radial-gradient(120% 105% at 50% 42%, #fffdf7 0%, #fff3e0 52%, #ffe3c2 82%, #ffd9ae 100%)' }}>
      <svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" role="img" aria-label="A tree whose canopy is a heart made of small hearts">
        {/* ambient floaters */}
        {FLOATERS.map(([x, y, s, c, dl], i) => (
          <g key={`f${i}`} className="floaty" style={{ animationDelay: `${dl}s, ${dl}s` }}>
            <path d={HEART} transform={`translate(${x - s / 2} ${y - s / 2}) scale(${s / 100})`} fill={c} opacity=".65" />
          </g>
        ))}

        {/* trunk + branches */}
        {BRANCHES.map(([d, w, dl], i) => (
          <path key={i} d={d} fill="none" stroke="#4a2c33" strokeWidth={w} strokeLinecap="round"
            pathLength={100} className="draw" style={{ animationDelay: `${dl}s`, animationDuration: i === 0 ? '1.5s' : '0.95s' }} />
        ))}

        {/* the heart canopy */}
        {CANOPY.map((p, i) => (
          <g key={i} className="bloom" style={{ animationDelay: `${p.d}s` }}>
            <g transform={`translate(${p.x} ${p.y}) rotate(${p.r})`}>
              <path d={HEART} transform={`translate(${-p.s / 2} ${-p.s / 2}) scale(${p.s / 100})`} fill={BLOOM_COLORS[p.c]} />
              <ellipse cx={-p.s * 0.16} cy={-p.s * 0.14} rx={p.s * 0.13} ry={p.s * 0.08} fill="#ffffff" opacity=".5" transform={`rotate(-18 ${-p.s * 0.16} ${-p.s * 0.14})`} />
            </g>
          </g>
        ))}
      </svg>

      {/* the .wish block — left:5.5%, bottom:10%, max-width:46% */}
      <div className="absolute" style={{ left: '5.5%', bottom: '9%', maxWidth: '46%', color: '#5d4037' }}>
        <p className="fade-soft font-serifit text-[17px] font-semibold italic" style={{ animationDelay: '2.6s' }}>
          and... make it count
        </p>
        <p className="font-script leading-[1.15]" style={{ fontSize: 'clamp(42px,6.9vw,80px)', color: '#c2185b' }}>
          {FULL.slice(0, n)}
        </p>
        <p className="fade-soft font-serifit text-[16.5px] font-medium" style={{ animationDelay: '4.9s', color: '#8a7368' }}>
          here&rsquo;s to a year that blooms
        </p>
      </div>
    </div>
  );
}

/* ══ App · the loop: heart → card → tree ══════════════════════════════════ */
type Scene = 'heart' | 'card' | 'tree';

export default function App() {
  const [scene, setScene] = useState<Scene>('heart');
  const [phase, setPhase] = useState<ShotPhase>('play');

  const handleHit = () => {
    setPhase('burst');
    window.setTimeout(() => setPhase('wipe'), 550);
    window.setTimeout(() => setScene('card'), 1430);
  };

  useEffect(() => {
    if (scene === 'heart') setPhase('play');
  }, [scene]);

  useEffect(() => {
    if (scene !== 'tree') return;
    const t = window.setTimeout(() => setScene('heart'), 9800);
    return () => window.clearTimeout(t);
  }, [scene]);

  return (
    <main className="relative h-full w-full overflow-hidden bg-[#fff9f3]">
      {scene === 'heart' && <HeartScene phase={phase} onHit={handleHit} />}
      {scene === 'card' && <CardScene onDone={() => setScene('tree')} />}
      {scene === 'tree' && <TreeScene />}
    </main>
  );
}
