import { useEffect, useRef, useState } from "react";

// ============================================================
// Тест скорости чтения. Читаешь текст в обычном темпе, жмёшь «Дочитал»,
// отвечаешь на два вопроса (чтобы не пролистывать). Слова в минуту
// переводятся в страницы в час: в среднем на странице русской книги
// ~260 слов (≈1800–2000 знаков).
// ============================================================

export const WORDS_PER_PAGE = 260;

interface Passage { title: string; text: string; questions: { q: string; options: string[]; answer: number }[] }

const PASSAGES: Passage[] = [
  {
    title: "Смотритель маяка",
    text: `Когда Матвей впервые приехал на остров, ему было двадцать шесть лет и он не умел ни чинить моторы, ни читать погоду по облакам. Прежний смотритель, сухой старик по фамилии Ерохин, оставил ему толстую тетрадь в клеёнчатой обложке и одну фразу на прощание: «Маяк не любит спешки». Тогда эта фраза показалась Матвею пустой, как и многое из того, что говорят люди, уходящие на пенсию.

Первую зиму он прожил почти без сна. Ему казалось, что лампа вот-вот погаснет, что генератор откажет, что какое-нибудь судно обязательно налетит на камни именно в его смену. Он вставал по три раза за ночь, поднимался по ста двенадцати ступеням и подолгу стоял у стекла, вглядываясь в темноту. Тетрадь Ерохина лежала на полке нераскрытой.

Открыл он её только в марте, когда сломался насос и вода в цистерне начала зеленеть. На первой же странице аккуратным почерком было написано, как прочистить фильтр, а ниже — список вещей, которые нужно делать каждый день, раз в неделю и раз в сезон. Ни одного слова о том, что надо вскакивать по ночам. Зато было подробно расписано, в какие месяцы прилетают крачки, где на северном берегу растёт дикий лук и почему нельзя оставлять открытой дверь в мастерскую, когда дует западный ветер.

К лету Матвей перестал подниматься к лампе без причины. Он починил лодку, научился различать по звуку, когда генератору нужно масло, и завёл свою тетрадь — тоже в клеёнчатой обложке. На её первой странице он написал ту самую фразу, которую когда-то не понял, а под ней добавил от себя: «И остров тоже».`,
    questions: [
      { q: "Сколько ступеней вело к лампе маяка?", options: ["Восемьдесят шесть", "Сто двенадцать", "Двести"], answer: 1 },
      { q: "Почему Матвей открыл тетрадь Ерохина?", options: ["Сломался насос", "Погасла лампа", "Приплыло судно"], answer: 0 },
    ],
  },
  {
    title: "Утренний рынок",
    text: `На рынке у вокзала день начинается раньше, чем в остальном городе. В половине пятого, когда трамваи ещё стоят в депо, к воротам подъезжает первый грузовик с картошкой, и сторож Анатолий, не глядя на часы, отпирает замок. Он работает здесь девятнадцать лет и узнаёт машины по звуку мотора, как другие узнают знакомых по походке.

Следом появляется Зарина, которая торгует зеленью. Она раскладывает укроп, петрушку и кинзу так, будто собирает букет, и всегда оставляет с краю несколько пучков мяты — для тех, кто заваривает чай. Напротив неё открывает свою лавку рыбник Степан. Он молчалив, но, если спросить, может полчаса рассказывать, чем северная корюшка отличается от ладожской и почему настоящий судак никогда не бывает слишком крупным.

К шести часам приходят первые покупатели. Это не те, кто выбирает долго и торгуется, а повара из ближайших кафе. Они знают продавцов по именам, берут помногу и почти не разговаривают: им нужно успеть до открытия кухни. Потом наступает короткое затишье, во время которого продавцы пьют чай из одного большого термоса и обсуждают погоду, цены на бензин и чьих-то внуков.

Настоящая толчея начинается ближе к девяти. Пенсионеры с сумками на колёсиках, студенты с одним яблоком в руке, мамы с колясками — все движутся медленно, останавливаются, пробуют. Анатолий в это время уже сидит у ворот на складном стуле и решает кроссворд. Ему кажется, что самое важное на рынке происходит до рассвета, когда никто ещё не видит, как из ничего, из ящиков и брезента, за час вырастает целый маленький город.`,
    questions: [
      { q: "Что Зарина всегда оставляет с краю прилавка?", options: ["Кинзу", "Мяту", "Укроп"], answer: 1 },
      { q: "Кто первые покупатели на рынке?", options: ["Пенсионеры", "Студенты", "Повара из кафе"], answer: 2 },
    ],
  },
];

function wordCount(t: string) { return t.split(/\s+/).filter(w => /[А-Яа-яЁёA-Za-z0-9]/.test(w)).length; }

type Stage = "intro" | "reading" | "questions" | "result";

export default function ReadingTest({ onResult, onClose }: { onResult: (pagesPerHour: number) => void; onClose: () => void }) {
  const [idx] = useState(() => Math.floor(Math.random() * PASSAGES.length));
  const p = PASSAGES[idx];
  const words = wordCount(p.text);
  const [stage, setStage] = useState<Stage>("intro");
  const [answers, setAnswers] = useState<(number | null)[]>(p.questions.map(() => null));
  const startRef = useRef(0);
  const [sec, setSec] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (stage !== "reading") return;
    const t = window.setInterval(() => setElapsed(Math.round((performance.now() - startRef.current) / 1000)), 1000);
    return () => window.clearInterval(t);
  }, [stage]);

  const wpm = sec > 0 ? Math.round((words / sec) * 60) : 0;
  const pph = Math.max(5, Math.round((wpm * 60) / WORDS_PER_PAGE));
  const correct = answers.filter((a, i) => a === p.questions[i].answer).length;
  // Быстрее ~900 слов/мин текст физически не читается — это пролистывание.
  const invalid = wpm > 900;

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal reading-test" onClick={ev => ev.stopPropagation()}>
        {stage === "intro" && <>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>📖 Тест скорости чтения</div>
          <div className="muted" style={{ lineHeight: 1.5, marginBottom: 12 }}>
            Прочитай короткий текст ({words} слов) в своём обычном темпе — так, как читаешь книгу для себя, не быстрее.
            Таймер стартует по кнопке. Потом два простых вопроса по тексту, чтобы проверить, что прочитано, а не пролистано.
          </div>
          <div className="reading-actions">
            <button type="button" className="warmup-start" onClick={() => { startRef.current = performance.now(); setElapsed(0); setStage("reading"); }}>Начать чтение</button>
            <span className="muted" style={{ cursor: "pointer" }} onClick={onClose}>Отмена</span>
          </div>
        </>}

        {stage === "reading" && <>
          <div className="reading-head"><b>{p.title}</b><span className="muted">⏱ {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span></div>
          <div className="reading-text">{p.text.split("\n\n").map((par, i) => <p key={i}>{par}</p>)}</div>
          <button type="button" className="warmup-start" style={{ width: "100%" }}
            onClick={() => { setSec((performance.now() - startRef.current) / 1000); setStage("questions"); }}>Дочитал</button>
        </>}

        {stage === "questions" && <>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Два вопроса по тексту</div>
          {p.questions.map((q, qi) => (
            <div key={qi} className="reading-q">
              <div>{q.q}</div>
              <div className="reading-options">
                {q.options.map((o, oi) => (
                  <span key={oi} className={answers[qi] === oi ? "on" : ""}
                    onClick={() => setAnswers(a => a.map((x, i) => (i === qi ? oi : x)))}>{o}</span>
                ))}
              </div>
            </div>
          ))}
          <button type="button" className="warmup-start" disabled={answers.some(a => a === null)} onClick={() => setStage("result")}>Показать результат</button>
        </>}

        {stage === "result" && <>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Результат</div>
          <div className="reading-result">
            <div><span>Скорость</span><b>{wpm} слов/мин</b></div>
            <div><span>Это примерно</span><b>{pph} стр/час</b></div>
            <div><span>Ответы</span><b>{correct} из {p.questions.length}</b></div>
          </div>
          <div className="muted" style={{ lineHeight: 1.5, margin: "10px 0 12px" }}>
            {correct < p.questions.length
              ? "Есть ошибка в ответах — возможно, читал слишком быстро. Можно сохранить как есть или пройти ещё раз в спокойном темпе."
              : wpm > 450 ? "Очень быстро — проверь, что читал в обычном темпе, а не пробегал глазами."
              : "Для сравнения: средний взрослый читатель — 150–250 слов в минуту, это 35–60 страниц в час."}
            {" "}Страницы считаются как ~{WORDS_PER_PAGE} слов — обычная страница книги.
          </div>
          {invalid ? (
            <div className="reading-actions">
              <span><b>Слишком быстро — тест не засчитан.</b> Прочитай текст целиком в обычном темпе.</span>
              <span className="muted" style={{ cursor: "pointer" }} onClick={onClose}>Закрыть</span>
            </div>
          ) : (
            <div className="reading-actions">
              <button type="button" className="warmup-start" onClick={() => { onResult(Math.min(300, pph)); onClose(); }}>Сохранить {Math.min(300, pph)} стр/час</button>
              <span className="muted" style={{ cursor: "pointer" }} onClick={onClose}>Не сохранять</span>
            </div>
          )}
        </>}
      </div>
    </div>
  );
}
