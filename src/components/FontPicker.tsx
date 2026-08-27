import { useEffect, useState } from "react";

const FONTS: [string, string][] = [
  ["Manrope", "Manrope (по умолчанию)"],
  ["Poppins", "Poppins"],
  ["Space Grotesk", "Space Grotesk"],
  ["Nunito", "Nunito"],
  ["Playfair Display", "Playfair Display"],
  ["system-ui", "Системный шрифт"],
];

let fontsLoaded = false;
function ensureFontsLoaded() {
  if (fontsLoaded) return;
  fontsLoaded = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&family=Poppins:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&family=Nunito:wght@400;600;700&family=Playfair+Display:wght@400;600;700&display=swap";
  document.head.appendChild(link);
}

export default function FontPicker() {
  const [font, setFont] = useState(() => localStorage.getItem("lifeos_font") || "Manrope");

  useEffect(() => {
    ensureFontsLoaded();
    document.body.style.fontFamily = `'${font}', -apple-system, sans-serif`;
    localStorage.setItem("lifeos_font", font);
  }, [font]);

  return (
    <select value={font} onChange={e => setFont(e.target.value)}
      style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--text)", padding: "4px 8px", fontSize: "0.75rem" }}
      title="Шрифт сайта (эксперимент, можно убрать)">
      {FONTS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
    </select>
  );
}
