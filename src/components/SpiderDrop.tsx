import { useEffect, useState } from "react";
import { Entity } from "../api";

export default function SpiderDrop({ entities }: { entities: Entity[] }) {
  const [dropping, setDropping] = useState(false);
  const [side, setSide] = useState(20);

  const active = entities.some(e =>
    ["movie", "show"].includes(e.type) &&
    e.attributes?.status === "in_progress" &&
    /человек-паук|spider-?man/i.test(e.name)
  );

  useEffect(() => {
    if (!active) return;
    function scheduleNext() {
      const delay = 60000 + Math.random() * 90000; // раз в 1-2.5 минуты
      return setTimeout(() => {
        setSide(10 + Math.random() * 80);
        setDropping(true);
        setTimeout(() => setDropping(false), 4500);
        timer = scheduleNext();
      }, delay);
    }
    let timer = scheduleNext();
    return () => clearTimeout(timer);
  }, [active]);

  if (!active || !dropping) return null;

  return (
    <div className="spider-drop" style={{ left: `${side}%` }}>
      <div className="spider-thread" />
      <div className="spider-icon">🕷️</div>
    </div>
  );
}
