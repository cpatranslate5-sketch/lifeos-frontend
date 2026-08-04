export const TYPES: Record<string, { label: string; color: string; emoji: string }> = {
  person:  { label: "Человек",       color: "var(--person)",  emoji: "👤" },
  project: { label: "Проект",        color: "var(--project)", emoji: "📁" },
  event:   { label: "Событие",       color: "var(--event)",   emoji: "📅" },
  goal:    { label: "Цель",          color: "var(--goal)",    emoji: "🎯" },
  habit:   { label: "Привычка",      color: "var(--habit)",   emoji: "🔁" },
  task:    { label: "Задача",        color: "var(--task)",    emoji: "✅" },
  movie:   { label: "Фильм",         color: "var(--movie)",   emoji: "🎬" },
  show:    { label: "Сериал",        color: "var(--show)",    emoji: "📺" },
  book:    { label: "Книга",         color: "var(--book)",    emoji: "📖" },
  game:    { label: "Игра",          color: "var(--game)",    emoji: "🎮" },
  leisure: { label: "Досуг",         color: "var(--leisure)", emoji: "🎈" },
};

export const ALL_EMOJI: string[] = [
  "👤", "🧑", "👨", "👩", "🧔", "👦", "👧",
  "📁", "🗂️", "💼", "🏗️", "🚀", "📊",
  "📅", "🗓️", "⏰", "📍", "🔔",
  "🎯", "🏆", "⭐", "🚩", "💡",
  "🔁", "🔄", "♻️", "🏋️", "🥊", "🧘", "🎾",
  "✅", "☑️", "📝", "🔧", "📌",
  "🎬", "🍿", "🎞️", "🎥", "🎦",
  "📺", "🖥️", "📡",
  "📖", "📚", "📔", "📕", "📗", "📘",
  "🎮", "🕹️", "👾", "🃏",
  "🎈", "🎨", "⚽", "✈️", "🎉", "🎣",
];
