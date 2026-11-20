"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/client";
import { chime } from "@/lib/sound";

// ---------------------------------------------------------------------------
// Tic-Tac-Toe — pass & play on one phone
// ---------------------------------------------------------------------------
type Cell = "" | "X" | "O";
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

export function winnerOf(b: Cell[]): { winner: "X" | "O" | "DRAW" | null; line?: number[] } {
  for (const l of LINES) {
    const [a, c, d] = l;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { winner: b[a] as "X" | "O", line: l };
  }
  return { winner: b.every(Boolean) ? "DRAW" : null };
}

export function TttBoard({ board, onMove, disabled, highlight }: { board: Cell[]; onMove: (i: number) => void; disabled?: boolean; highlight?: number[] }) {
  return (
    <div className="mx-auto my-3 grid max-w-[280px] grid-cols-3 gap-2.5">
      {board.map((cell, i) => (
        <button
          key={i}
          onClick={() => onMove(i)}
          disabled={disabled || !!cell}
          aria-label={`Square ${i + 1}${cell ? `, ${cell}` : ""}`}
          className={cn(
            "grid aspect-square place-items-center rounded-2xl border font-display text-4xl font-black transition active:scale-95",
            highlight?.includes(i) ? "border-emerald-400 bg-emerald-500/15" : "border-line bg-sand enabled:hover:border-brand-500/50",
            cell === "X" ? "text-brand-600" : "text-indigo-700",
          )}
        >
          {cell}
        </button>
      ))}
    </div>
  );
}

export function LocalTicTacToe() {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(""));
  const [turn, setTurn] = useState<"X" | "O">("X");
  const [score, setScore] = useState({ X: 0, O: 0, draw: 0 });
  const result = winnerOf(board);

  function move(i: number) {
    if (board[i] || result.winner) return;
    const next = [...board];
    next[i] = turn;
    setBoard(next);
    chime("tap");
    const r = winnerOf(next);
    if (r.winner) {
      chime("success");
      setScore((s) => (r.winner === "DRAW" ? { ...s, draw: s.draw + 1 } : { ...s, [r.winner!]: s[r.winner as "X" | "O"] + 1 }));
    } else setTurn(turn === "X" ? "O" : "X");
  }
  function reset() {
    setBoard(Array(9).fill(""));
    setTurn(result.winner === "X" ? "O" : "X"); // loser starts next round
  }

  return (
    <GameCard title="Zero Kata (Tic-Tac-Toe)" subtitle="Pass the phone — X vs O" onReset={reset}>
      <Score left={`X · ${score.X}`} mid={`Draw ${score.draw}`} right={`O · ${score.O}`} />
      <Status>
        {result.winner === "DRAW" ? "🤝 Draw! Ek aur round?" : result.winner ? `🎉 Player ${result.winner} wins!` : `Player ${turn}'s turn`}
      </Status>
      <TttBoard board={board} onMove={move} disabled={!!result.winner} highlight={result.line} />
      {result.winner && <PlayAgain onClick={reset} />}
    </GameCard>
  );
}

// ---------------------------------------------------------------------------
// Quiz — two teams take turns
// ---------------------------------------------------------------------------
const QUESTIONS: { q: string; opts: string[]; ans: number }[] = [
  { q: "Mumbai ke famous 'Vada Pav' ko aur kis naam se bulaya jaata hai?", opts: ["Indian Burger", "Desi Taco", "Spicy Bun", "Bombay Roll"], ans: 0 },
  { q: "MS Dhoni ne kis saal India ko T20 World Cup jitaya tha?", opts: ["2005", "2007", "2011", "2013"], ans: 1 },
  { q: "Adrak wali chai ke saath sabse classic combo kya hai?", opts: ["Nachos", "Bun Maska / Parle-G", "Sushi", "Croissant"], ans: 1 },
  { q: "Movie '3 Idiots' mein Rancho ka asli naam kya tha?", opts: ["Chatur Ramalingam", "Phunsukh Wangdu", "Raju Rastogi", "Virus"], ans: 1 },
  { q: "Kulhad chai ka maza kis khushboo se aata hai?", opts: ["Mitti (earthy aroma)", "Mint", "Vanilla", "Caramel"], ans: 0 },
  { q: "'Darjeeling' tea kis state se aati hai?", opts: ["Assam", "Kerala", "West Bengal", "Sikkim"], ans: 2 },
  { q: "Sachin Tendulkar ne kitne international centuries banayi?", opts: ["90", "100", "110", "75"], ans: 1 },
  { q: "'Pani Puri' ko Kolkata mein kya kehte hain?", opts: ["Golgappa", "Puchka", "Gupchup", "Pakodi"], ans: 1 },
  { q: "Film 'Sholay' mein Gabbar Singh ka role kisne kiya?", opts: ["Amjad Khan", "Amrish Puri", "Pran", "Prem Chopra"], ans: 0 },
  { q: "India mein sabse zyada chai kaunsa state ugata hai?", opts: ["Kerala", "Assam", "Tamil Nadu", "Himachal"], ans: 1 },
  { q: "Cricket mein 'Hat-trick' ka matlab hai?", opts: ["3 sixes in a row", "3 wickets in 3 balls", "3 catches", "3 run-outs"], ans: 1 },
  { q: "'Dosa' originally kis region ki dish hai?", opts: ["Punjab", "South India", "Gujarat", "Bengal"], ans: 1 },
  { q: "Bollywood ke 'Baadshah' kise kehte hain?", opts: ["Salman Khan", "Aamir Khan", "Shah Rukh Khan", "Akshay Kumar"], ans: 2 },
  { q: "Espresso kis country ki den hai?", opts: ["France", "Brazil", "Italy", "Turkey"], ans: 2 },
  { q: "IPL mein sabse zyada titles (2024 tak) kis team ke paas hain?", opts: ["MI & CSK (5 each)", "KKR", "RCB", "SRH"], ans: 0 },
  { q: "'Jalebi' ka shape kaisa hota hai?", opts: ["Square", "Spiral", "Triangle", "Star"], ans: 1 },
  { q: "Film 'Lagaan' kis game ke baare mein thi?", opts: ["Hockey", "Kabaddi", "Cricket", "Football"], ans: 2 },
  { q: "Masala chai mein kaunsa masala usually NAHI daalte?", opts: ["Elaichi", "Laung", "Haldi", "Adrak"], ans: 2 },
  { q: "'Chhole Bhature' kis city ka famous hai?", opts: ["Delhi", "Chennai", "Goa", "Shillong"], ans: 0 },
  { q: "Indian cricket team ki jersey ka colour?", opts: ["Green", "Blue", "Yellow", "Red"], ans: 1 },
  { q: "'Filter coffee' kis cheez mein serve hoti hai?", opts: ["Kulhad", "Davara-tumbler", "Mug", "Glass jar"], ans: 1 },
  { q: "Film 'Dilwale Dulhania Le Jayenge' kis saal aayi?", opts: ["1992", "1995", "1998", "2001"], ans: 1 },
];

function shuffle<T>(a: T[]) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

const ROUND = 10;

export function LocalQuiz() {
  const [seed, setSeed] = useState(0);
  const deck = useMemo(() => shuffle(QUESTIONS).slice(0, ROUND), [seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const [idx, setIdx] = useState(0);
  const [scores, setScores] = useState([0, 0]);
  const [picked, setPicked] = useState<number | null>(null);
  const team = idx % 2; // teams alternate questions
  const done = idx >= ROUND;
  const q = deck[Math.min(idx, ROUND - 1)];

  function answer(i: number) {
    if (picked !== null || done) return;
    setPicked(i);
    if (i === q.ans) {
      chime("success");
      setScores((s) => s.map((v, t) => (t === team ? v + 10 : v)));
    }
    setTimeout(() => {
      setPicked(null);
      setIdx((n) => n + 1);
    }, 1300);
  }
  function reset() {
    setSeed((s) => s + 1);
    setIdx(0);
    setScores([0, 0]);
    setPicked(null);
  }

  return (
    <GameCard title="Chai Pe Charcha Quiz" subtitle="Bollywood, cricket & desi food · Team A vs Team B take turns" onReset={reset}>
      <Score left={`Team A · ${scores[0]}`} mid={done ? "Final" : `Q ${idx + 1}/${ROUND}`} right={`Team B · ${scores[1]}`} />
      {done ? (
        <div className="py-6 text-center">
          <div className="text-4xl">{scores[0] === scores[1] ? "🤝" : "🏆"}</div>
          <div className="mt-2 font-display text-lg font-extrabold text-ink">
            {scores[0] === scores[1] ? "It's a tie!" : `Team ${scores[0] > scores[1] ? "A" : "B"} wins!`}
          </div>
          <PlayAgain onClick={reset} />
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-sand p-4">
          <p className={cn("mb-1 text-[11px] font-bold uppercase", team === 0 ? "text-brand-600" : "text-indigo-700")}>Team {team === 0 ? "A" : "B"}&apos;s question</p>
          <h4 className="mb-4 text-sm font-bold text-ink sm:text-base">{q.q}</h4>
          <div className="space-y-2">
            {q.opts.map((opt, i) => (
              <button
                key={opt}
                onClick={() => answer(i)}
                disabled={picked !== null}
                className={cn(
                  "w-full rounded-xl border p-3 text-left text-sm font-semibold transition",
                  picked === null && "border-line bg-white text-ink hover:border-brand-500/50 hover:bg-brand-600/10",
                  picked !== null && i === q.ans && "border-emerald-500 bg-emerald-500/20 text-emerald-700",
                  picked !== null && i === picked && i !== q.ans && "border-rose-500 bg-rose-500/20 text-rose-600",
                  picked !== null && i !== picked && i !== q.ans && "border-line bg-white text-ink-3",
                )}
              >
                {String.fromCharCode(65 + i)}. {opt}
              </button>
            ))}
          </div>
          {picked !== null && (
            <p className={cn("mt-3 text-sm font-bold", picked === q.ans ? "text-emerald-700" : "text-rose-600")}>
              {picked === q.ans ? "✅ Sahi jawab! +10" : `❌ Galat! Sahi jawab: ${q.opts[q.ans]}`}
            </p>
          )}
        </div>
      )}
    </GameCard>
  );
}

// ---------------------------------------------------------------------------
// Stone Paper Scissors vs Cafe Bot
// ---------------------------------------------------------------------------
export const RPS_ICON = { rock: "🪨", paper: "📄", scissors: "✂️" } as const;
export type Rps = keyof typeof RPS_ICON;
export const RPS_LABEL: Record<Rps, string> = { rock: "Stone", paper: "Paper", scissors: "Scissors" };
const beats = (a: Rps, b: Rps) => (a === "rock" && b === "scissors") || (a === "paper" && b === "rock") || (a === "scissors" && b === "paper");

export function LocalRps() {
  const [you, setYou] = useState<Rps | null>(null);
  const [bot, setBot] = useState<Rps | null>(null);
  const [score, setScore] = useState({ you: 0, bot: 0 });
  const [msg, setMsg] = useState("Choose your move!");

  function play(c: Rps) {
    const b = (["rock", "paper", "scissors"] as Rps[])[Math.floor(Math.random() * 3)];
    setYou(c);
    setBot(b);
    if (c === b) setMsg("🤝 Tie! Dono ne same chuna!");
    else if (beats(c, b)) {
      setScore((s) => ({ ...s, you: s.you + 1 }));
      setMsg("🎉 Jeet gaye!");
      chime("success");
    } else {
      setScore((s) => ({ ...s, bot: s.bot + 1 }));
      setMsg("😅 Cafe Bot wins this round!");
    }
  }

  return (
    <GameCard title="Stone • Paper • Scissors" subtitle="Beat the Cafe Bot 🤖" onReset={() => { setScore({ you: 0, bot: 0 }); setYou(null); setBot(null); setMsg("Choose your move!"); }}>
      <RpsArena leftLabel="You" rightLabel="Cafe Bot 🤖" left={you ? RPS_ICON[you] : "🤜"} right={bot ? RPS_ICON[bot] : "🤛"} leftScore={score.you} rightScore={score.bot} />
      <p className="mb-3 text-center text-sm font-bold text-brand-600">{msg}</p>
      <RpsButtons onPick={play} />
    </GameCard>
  );
}

export function RpsArena(p: { leftLabel: string; rightLabel: string; left: string; right: string; leftScore: number; rightScore: number }) {
  return (
    <div className="mb-4 flex items-center justify-around rounded-2xl border border-line bg-sand p-4 text-center">
      <div>
        <p className="mb-1 text-[11px] text-ink-2">{p.leftLabel}</p>
        <div className="text-5xl">{p.left}</div>
        <p className="mt-1 text-xs font-bold text-brand-600">Wins: {p.leftScore}</p>
      </div>
      <div className="text-sm font-extrabold text-ink-3">VS</div>
      <div>
        <p className="mb-1 text-[11px] text-ink-2">{p.rightLabel}</p>
        <div className="text-5xl">{p.right}</div>
        <p className="mt-1 text-xs font-bold text-indigo-700">Wins: {p.rightScore}</p>
      </div>
    </div>
  );
}

export function RpsButtons({ onPick, disabled }: { onPick: (r: Rps) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {(Object.keys(RPS_ICON) as Rps[]).map((r) => (
        <button
          key={r}
          disabled={disabled}
          onClick={() => onPick(r)}
          className="rounded-xl bg-sand-2 py-3 text-sm font-bold transition hover:bg-brand-600 hover:text-white active:scale-95 disabled:opacity-40 disabled:hover:bg-sand-2 disabled:hover:text-ink"
        >
          {RPS_ICON[r]} {RPS_LABEL[r]}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// shared bits
// ---------------------------------------------------------------------------
export function GameCard({ title, subtitle, onReset, children, extra }: { title: string; subtitle: string; onReset?: () => void; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 animate-pop">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold text-ink">{title}</h3>
          <p className="text-xs text-ink-2">{subtitle}</p>
        </div>
        {extra}
        {onReset && (
          <button onClick={onReset} className="flex shrink-0 items-center gap-1 rounded-lg bg-sand-2 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-line">
            <RotateCcw className="size-3" /> Reset
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function Score({ left, mid, right }: { left: string; mid: string; right: string }) {
  return (
    <div className="mb-2 flex items-center justify-between text-xs font-extrabold">
      <span className="text-brand-600">{left}</span>
      <span className="text-ink-3">{mid}</span>
      <span className="text-indigo-700">{right}</span>
    </div>
  );
}

export function Status({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-line bg-sand px-3 py-2 text-center text-sm font-bold text-brand-600">{children}</div>;
}

export function PlayAgain({ onClick, label = "Play again" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="mx-auto mt-2 block rounded-xl bg-brand-600 px-5 py-2 text-sm font-extrabold text-white hover:bg-brand-700">
      {label}
    </button>
  );
}
