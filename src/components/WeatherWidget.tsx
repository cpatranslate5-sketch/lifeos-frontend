import { useEffect, useState } from "react";

interface WeatherData {
  temp: number;
  code: number;
  precipChance: number;
}

const WEATHER_DESC: Record<number, [string, string]> = {
  0: ["Ясно", "☀️"], 1: ["Малооблачно", "🌤️"], 2: ["Облачно с прояснениями", "⛅"], 3: ["Пасмурно", "☁️"],
  45: ["Туман", "🌫️"], 48: ["Туман", "🌫️"],
  51: ["Морось", "🌦️"], 53: ["Морось", "🌦️"], 55: ["Морось", "🌦️"],
  61: ["Небольшой дождь", "🌧️"], 63: ["Дождь", "🌧️"], 65: ["Сильный дождь", "🌧️"],
  71: ["Небольшой снег", "🌨️"], 73: ["Снег", "🌨️"], 75: ["Сильный снегопад", "❄️"],
  80: ["Ливень", "🌧️"], 81: ["Ливень", "🌧️"], 82: ["Сильный ливень", "⛈️"],
  95: ["Гроза", "⛈️"], 96: ["Гроза с градом", "⛈️"], 99: ["Гроза с градом", "⛈️"],
};

function describe(code: number): [string, string] {
  return WEATHER_DESC[code] || ["—", "🌡️"];
}

const COORDS_KEY = "lifeos_weather_coords";

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadWeather(lat: number, lon: number) {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&daily=precipitation_probability_max&timezone=auto`);
        const data = await res.json();
        setWeather({
          temp: Math.round(data.current.temperature_2m),
          code: data.current.weathercode,
          precipChance: data.daily?.precipitation_probability_max?.[0] ?? 0,
        });
      } catch {
        setError(true);
      }
    }

    const saved = localStorage.getItem(COORDS_KEY);
    if (saved) {
      const { lat, lon } = JSON.parse(saved);
      loadWeather(lat, lon);
      return;
    }

    if (!navigator.geolocation) { setError(true); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        localStorage.setItem(COORDS_KEY, JSON.stringify({ lat: latitude, lon: longitude }));
        loadWeather(latitude, longitude);
      },
      () => setError(true)
    );
  }, []);

  if (error) return null;
  if (!weather) return null;

  const [label, icon] = describe(weather.code);

  return (
    <div className="weather-widget">
      <span className="weather-icon">{icon}</span>
      <span className="weather-temp">{weather.temp}°</span>
      <span className="weather-label">{label}</span>
      {weather.precipChance >= 40 && <span className="weather-rain">💧 {weather.precipChance}%</span>}
    </div>
  );
}
