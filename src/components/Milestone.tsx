import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Entity } from "../api";

// Поздравление при круглом числе: 10, 20, 30… отмеченных фильмов/сериалов/книг/игр.
function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const KINDS: Record<string, { emoji: string; text: (n: number) => string }> = {
  movie: { emoji: "🎬", text: n => `Вы посмотрели ${n} ${plural(n, "фильм", "фильма", "фильмов")}!` },
  show: { emoji: "📺", text: n => `Вы посмотрели ${n} ${plural(n, "сериал", "сериала", "сериалов")}!` },
  book: { emoji: "📚", text: n => `Вы прочли ${n} ${plural(n, "книгу", "книги", "книг")}!` },
  game: { emoji: "🎮", text: n => `Вы прошли ${n} ${plural(n, "игру", "игры", "игр")}!` },
};

const COLORS = ["#FF5E5B", "#FFB400", "#3EC300", "#00A6ED", "#9B5DE5", "#F15BB5", "#FEE440", "#00F5D4"];

export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!; const ctx = c.getContext("2d")!;
    const W = (c.width = window.innerWidth), H = (c.height = window.innerHeight);
    const parts = Array.from({ length: 220 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      return {
        x: fromLeft ? -10 : W + 10, y: H * (0.55 + Math.random() * 0.4),
        vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 9), vy: -(10 + Math.random() * 12),
        r: 4 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        color: COLORS[i % COLORS.length], shape: i % 3,
      };
    });
    let raf = 0, frame = 0;
    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += 0.28; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
        if (p.shape === 0) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, p.r / 1.6, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(0, -p.r); ctx.lineTo(p.r, p.r); ctx.lineTo(-p.r, p.r); ctx.fill(); }
        ctx.restore();
      }
      if (frame < 420) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="milestone-confetti" />;
}

export function MilestonePopup({ type, n, onClose }: { type: string; n: number; onClose: () => void }) {
  const k = KINDS[type] || KINDS.movie;
  useEffect(() => { const id = setTimeout(onClose, 9000); return () => clearTimeout(id); }, []);
  const big = n % 100 === 0;
  return createPortal(
    <div className="milestone-bg" onClick={onClose}>
      <Confetti />
      <div className={`milestone-card ${big ? "big" : ""}`} onClick={e => e.stopPropagation()}>
        <div className="milestone-emoji">{big ? "🏆" : k.emoji}</div>
        <div className="milestone-number">{n}</div>
        <div className="milestone-title">Поздравляем!</div>
        <div className="milestone-text">{k.text(n)}</div>
        {big && <div className="milestone-sub">Это уже настоящий юбилей 🎉</div>}
        <button onClick={onClose}>Ура! 🎉</button>
      </div>
    </div>,
    document.body
  );
}

// Следит за числом отмеченных карточек и показывает поздравление,
// когда после отметки оно стало круглым (10, 20, 30…).
export default function MilestoneWatcher({ entities, scopeKey }: { entities: Entity[]; scopeKey: string }) {
  const prev = useRef<{ key: string; counts: Record<string, number> } | null>(null);
  const [show, setShow] = useState<{ type: string; n: number } | null>(null);

  useEffect(() => {
    const counts: Record<string, number> = {};
    for (const t of Object.keys(KINDS)) counts[t] = entities.filter(e => e.type === t && e.attributes?.done).length;
    const p = prev.current;
    if (p && p.key === scopeKey) {
      for (const t of Object.keys(KINDS)) {
        const before = p.counts[t] ?? 0, now = counts[t];
        // только когда это результат отметки (+1…+3), а не загрузка всего списка
        if (now > before && now - before <= 3 && Math.floor(now / 10) > Math.floor(before / 10)) {
          setShow({ type: t, n: Math.floor(now / 10) * 10 });
          break;
        }
      }
    }
    // пустой список во время загрузки не запоминаем, чтобы не было ложных поздравлений
    if (entities.length > 0 || !p || p.key !== scopeKey) prev.current = { key: scopeKey, counts };
  }, [entities, scopeKey]);

  return show ? <MilestonePopup type={show.type} n={show.n} onClose={() => setShow(null)} /> : null;
}
