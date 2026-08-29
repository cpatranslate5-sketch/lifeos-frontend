import { useEffect, useState } from "react";

interface CityWeather {
  name: string;
  temp: number;
  code: number;
}

const CITIES: { name: string; lat: number; lon: number }[] = [
  { name: "Москва", lat: 55.7558, lon: 37.6173 },
  { name: "Батуми", lat: 41.6168, lon: 41.6367 },
  { name: "Волгоград", lat: 48.7080, lon: 44.5133 },
];

const WEATHER_ICON: Record<number, string> = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌦️",
  61: "🌧️", 63: "🌧️", 65: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "❄️",
  80: "🌧️", 81: "🌧️", 82: "⛈️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};

function iconFor(code: number): string {
  return WEATHER_ICON[code] || "🌡️";
}

export default function WeatherWidget() {
  const [data, setData] = useState<CityWeather[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const results = await Promise.all(CITIES.map(async city => {
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,weathercode&timezone=auto`);
          const json = await res.json();
          return { name: city.name, temp: Math.round(json.current.temperature_2m), code: json.current.weathercode };
        }));
        setData(results);
      } catch {
        setError(true);
      }
    }
    load();
  }, []);

  if (error || !data) return null;

  return (
    <div className="weather-widget">
      {data.map(c => (
        <div key={c.name} className="weather-city">
          <span className="weather-city-name">{c.name}</span>
          <span className="weather-icon">{iconFor(c.code)}</span>
          <span className="weather-temp">{c.temp}°</span>
        </div>
      ))}
    </div>
  );
}
