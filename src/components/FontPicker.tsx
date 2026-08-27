import { useEffect, useState } from "react";

const FONTS: [string, string][] = [
  ["Manrope", "Manrope (по умолчанию)"],
  ["Poppins", "Poppins"],
  ["Space Grotesk", "Space Grotesk"],
  ["Nunito", "Nunito"],
  ["Playfair Display", "Playfair Display"],
  ["Inter", "Inter"],
  ["DM Sans", "DM Sans"],
  ["Outfit", "Outfit"],
  ["Sora", "Sora"],
  ["Plus Jakarta Sans", "Plus Jakarta Sans"],
  ["Work Sans", "Work Sans"],
  ["Lexend", "Lexend"],
  ["Comfortaa", "Comfortaa (округлый)"],
  ["Unbounded", "Unbounded (жирный, необычный)"],
  ["Caveat", "Caveat (рукописный)"],
  ["system-ui", "Системный шрифт"],
];

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Manrope:wght@400;600;700",
    "family=Poppins:wght@400;600;700",
    "family=Space+Grotesk:wght@400;600;700",
    "family=Nunito:wght@400;600;700",
    "family=Playfair+Display:wght@400;600;700",
    "family=Inter:wght@400;600;700",
    "family=DM+Sans:wght@400;600;700",
    "family=Outfit:wght@400;600;700",
    "family=Sora:wght@400;600;700",
    "family=Plus+Jakarta+Sans:wght@400;600;700",
    "family=Work+Sans:wght@400;600;700",
    "family=Lexend:wght@400;600;700",
    "family=Comfortaa:wght@400;600;700",
    "family=Unbounded:wght@400;600;700",
    "family=Caveat:wght@400;600;700",
  ].join("&") + "&display=swap";

let fontsLoaded = false;
function ensureFontsLoaded() {
  if (fontsLoaded) return;
  fontsLoaded = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = GOOGLE_FONTS_URL;
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
