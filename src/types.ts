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
  order:   { label: "Заказ",         color: "var(--order)",   emoji: "📦" },
  anniversary: { label: "Дата",      color: "var(--anniversary)", emoji: "🎉" },
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

export const GEO_OPTIONS = ["Европа", "Азия", "Америка", "Россия", "Остальное"];

export const BOOK_GENRES = [
  "Детектив", "Классика", "Ужасы/Мистика", "Фантастика", "Фэнтези", "Антиутопия",
  "Приключения", "История", "Психология", "Биография", "Спорт", "Бизнес/Финансы",
  "Саморазвитие", "Комиксы", "True Crime",
];

export const MOVIE_GENRES = [
  "Marvel/DC", "Аниме", "Фэнтези", "Фантастика", "Драма", "Триллер", "Детектив",
  "История", "Ужасы/Мистика", "Антиутопия", "Постапокалипсис", "Биография", "Мюзикл",
  "True Crime", "Мультфильм", "Ромком", "Мелодрама", "Комедия", "Семейный",
];

export const SHOW_GENRES = [...MOVIE_GENRES, "Мини-сериал"];

export function genresFor(type: string): string[] {
  if (type === "book") return BOOK_GENRES;
  if (type === "movie") return MOVIE_GENRES;
  if (type === "show") return SHOW_GENRES;
  return [];
}

export function authorLabelFor(type: string): string {
  return type === "book" ? "Автор" : "Режиссёр";
}
