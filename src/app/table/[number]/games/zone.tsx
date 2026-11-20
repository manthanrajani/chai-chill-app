"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { Brain, Hash, Hand, Swords, Trophy, Users, Wifi, Loader2, LogOut } from "lucide-react";
import { api, cn, fetcher } from "@/lib/client";
import { chime } from "@/lib/sound";
import { useToast } from "@/components/toast";
import { LocalQuiz, LocalRps, LocalTicTacToe, GameCard, PlayAgain, RpsArena, RpsButtons, RPS_ICON, Status, TttBoard, winnerOf, Score, type Rps } from "./local-games";

type TableRef = { id: number; number: number; label: string | null };
type Match = {
  id: string;
  kind: "TTT" | "RPS";
  status: "PENDING" | "ACTIVE" | "FINISHED" | "DECLINED" | "CANCELLED";
  hostTableId: number;
  guestTableId: number;
  winnerTableId: number | null;
  hostTable: TableRef;
  guestTable: TableRef;
  state: {
    board?: ("" | "X" | "O")[];
    turn?: "X" | "O";
    target?: number;
    hostMove?: Rps | "hidden" | null;
    guestMove?: Rps | "hidden" | null;
    hostScore?: number;
    guestScore?: number;
    rounds?: { host: Rps; guest: Rps; winner: "host" | "guest" | "draw" }[];
    taunt?: { fromTableId: number; text: string; at: string } | null;
  };
};
type Lobby = {
  tableId: number;
  online: TableRef[];
  incoming: (Match & { hostTable: TableRef })[];
  outgoing: (Match & { guestTable: TableRef }) | null;
  current: Match | null;
  taunts: string[];
};

const pad = (n: number) => String(n).padStart(2, "0");
const KIND_LABEL = { TTT: "Tic-Tac-Toe", RPS: "Stone-Paper-Scissors" };

function useLobby(code: string, fast: boolean) {
  return useSWR<Lobby>(`/api/t/${code}/games`, fetcher, { refreshInterval: fast ? 1500 : 5000 });
}

/** Shows a popup when another table challenges this one (while the customer is on the menu tab). */
export function IncomingWatcher({ code, onOpen }: { code: string; onOpen: () => void }) {
  const { data } = useLobby(code, false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const show = data?.incoming.find((i) => !dismissed.includes(i.id)) ?? null;
  const rung = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (show && !rung.current.has(show.id)) {
      rung.current.add(show.id);
      chime("alert");
    }
  }, [show]);
  if (!show) return null;
  return (
    <div className="fixed inset-x-0 bottom-24 z-40 mx-auto w-full max-w-md px-3 animate-slide-up">
      <div className="flex items-center gap-3 rounded-2xl border border-indigo-400/50 bg-indigo-50 p-3 shadow-2xl backdrop-blur">
        <Swords className="size-6 shrink-0 text-indigo-700" />
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-bold text-ink">Table {pad(show.hostTable.number)} challenged you!</div>
          <div className="text-xs text-indigo-700">{KIND_LABEL[show.kind]} — accept in Play & Chill</div>
        </div>
        <button onClick={() => { setDismissed((d) => [...d, show.id]); onOpen(); }} className="rounded-xl bg-indigo-500 px-3 py-2 text-xs font-bold text-white">View</button>
      </div>
    </div>
  );
}

export function GamesZone({ code, tableId, tableNumber, visible }: { code: string; tableId: number; tableNumber: number; visible: boolean }) {
  const [chosenMode, setMode] = useState<"friends" | "tables" | null>(null);
  const [game, setGame] = useState<"ttt" | "quiz" | "rps">("ttt");
  const lobby = useLobby(code, visible && chosenMode !== "friends");
  const onlineCount = lobby.data?.online.length ?? 0;
  const hasIncoming = (lobby.data?.incoming.length ?? 0) > 0 || lobby.data?.current?.status === "ACTIVE";

  // until the guests pick a mode, jump to the online arena when a challenge arrives or a match starts
  const mode = chosenMode ?? (hasIncoming ? "tables" : "friends");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
            <Trophy className="size-4 text-brand-600" /> Table Gaming Arena
          </h2>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <span className="size-1.5 rounded-full bg-emerald-700" /> {onlineCount} other table{onlineCount === 1 ? "" : "s"} online
          </span>
        </div>
        <p className="mb-3 text-xs text-ink-2">Order aane tak doston ke saath khelein ya bagal wali table ko challenge karein!</p>
        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-line bg-sand p-1">
          <ModeBtn active={mode === "friends"} onClick={() => setMode("friends")} icon={<Users className="size-3.5" />} label="Same table" />
          <ModeBtn active={mode === "tables"} onClick={() => setMode("tables")} icon={<Wifi className="size-3.5" />} label="Vs other tables" dot={hasIncoming} />
        </div>
      </div>

      {mode === "friends" ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <GamePick active={game === "ttt"} onClick={() => setGame("ttt")} icon={<Hash className="size-4" />} label="Tic-Tac-Toe" />
            <GamePick active={game === "quiz"} onClick={() => setGame("quiz")} icon={<Brain className="size-4" />} label="Desi Quiz" />
            <GamePick active={game === "rps"} onClick={() => setGame("rps")} icon={<Hand className="size-4" />} label="Stone Paper" />
          </div>
          {game === "ttt" && <LocalTicTacToe />}
          {game === "quiz" && <LocalQuiz />}
          {game === "rps" && <LocalRps />}
        </>
      ) : (
        <OnlineArena code={code} tableId={tableId} tableNumber={tableNumber} lobby={lobby.data} mutate={lobby.mutate} />
      )}
    </div>
  );
}

function OnlineArena({ code, tableId, tableNumber, lobby, mutate }: { code: string; tableId: number; tableNumber: number; lobby?: Lobby; mutate: (d?: Lobby) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<"TTT" | "RPS">("TTT");

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const data = await api<Lobby>(`/api/t/${code}/games`, "POST", body);
      mutate(data);
    } catch (e) {
      toast((e as Error).message, { tone: "warning" });
      mutate();
    } finally {
      setBusy(false);
    }
  }

  if (!lobby) return <div className="h-40 animate-pulse rounded-2xl bg-white" />;
  const m = lobby.current;

  if (m && (m.status === "ACTIVE" || m.status === "FINISHED" || m.status === "DECLINED")) {
    if (m.status === "DECLINED") {
      return (
        <GameCard title="Challenge declined" subtitle={`Table ${pad(m.guestTable.number)} is busy right now`}>
          <PlayAgain onClick={() => act({ action: "leave", matchId: m.id }).then(() => mutate())} label="Back to lobby" />
        </GameCard>
      );
    }
    return <LiveMatch match={m} tableId={tableId} tableNumber={tableNumber} taunts={lobby.taunts} busy={busy} act={act} />;
  }

  return (
    <div className="space-y-3">
      {lobby.incoming.map((c) => (
        <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-indigo-400/60 bg-indigo-500/15 p-3 animate-pop">
          <Swords className="size-6 shrink-0 text-indigo-700" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-ink">Table {pad(c.hostTable.number)} challenges you!</div>
            <div className="text-xs text-indigo-700">{KIND_LABEL[c.kind]}</div>
          </div>
          <button disabled={busy} onClick={() => act({ action: "respond", matchId: c.id, accept: false })} className="rounded-lg px-2.5 py-2 text-xs font-bold text-ink-2">Decline</button>
          <button disabled={busy} onClick={() => act({ action: "respond", matchId: c.id, accept: true })} className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-bold text-white">Accept</button>
        </div>
      ))}

      {lobby.outgoing ? (
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
          <Loader2 className="size-5 shrink-0 animate-spin text-brand-600" />
          <div className="flex-1 text-sm">
            <div className="font-bold text-ink">Waiting for Table {pad(lobby.outgoing.guestTable.number)}…</div>
            <div className="text-xs text-ink-2">{KIND_LABEL[lobby.outgoing.kind]} · challenge expires in 2 min</div>
          </div>
          <button disabled={busy} onClick={() => act({ action: "leave", matchId: lobby.outgoing!.id })} className="text-xs font-bold text-rose-600">Cancel</button>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-ink">Challenge a table</h3>
            <div className="flex rounded-lg border border-line bg-sand p-0.5 text-[11px] font-bold">
              {(["TTT", "RPS"] as const).map((k) => (
                <button key={k} onClick={() => setKind(k)} className={cn("rounded-md px-2.5 py-1", kind === k ? "bg-ink text-white" : "text-ink-2")}>
                  {k === "TTT" ? "Tic-Tac-Toe" : "Stone-Paper"}
                </button>
              ))}
            </div>
          </div>
          {lobby.online.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-2 p-4 text-center text-xs text-ink-2">
              No other tables are online right now. When guests at another table open their menu, they&apos;ll show up here.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {lobby.online.map((t) => (
                <button
                  key={t.id}
                  disabled={busy}
                  onClick={() => act({ action: "challenge", opponentTableId: t.id, kind })}
                  className="rounded-xl border border-line bg-sand p-2.5 text-left transition hover:border-indigo-500/60 hover:bg-indigo-500/10 disabled:opacity-50"
                >
                  <div className="text-sm font-extrabold text-ink">Table {pad(t.number)}</div>
                  <div className="truncate text-[10px] text-indigo-700">{t.label ?? "Tap to challenge"}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LiveMatch({ match: m, tableId, tableNumber, taunts, busy, act }: { match: Match; tableId: number; tableNumber: number; taunts: string[]; busy: boolean; act: (b: Record<string, unknown>) => Promise<void> }) {
  const isHost = m.hostTableId === tableId;
  const opp = isHost ? m.guestTable : m.hostTable;
  const over = m.status === "FINISHED";
  const iWon = over && m.winnerTableId === tableId;
  const draw = over && m.winnerTableId === null;

  // chime on win / taunts
  const lastTaunt = useRef<string | null>(null);
  const toast = useToast();
  useEffect(() => {
    const t = m.state.taunt;
    if (t && t.at !== lastTaunt.current) {
      if (lastTaunt.current !== null && t.fromTableId !== tableId) {
        toast(`Table ${pad(opp.number)}: ${t.text}`, { tone: "info" });
        chime("tap");
      }
      lastTaunt.current = t.at;
    } else if (lastTaunt.current === null) lastTaunt.current = t?.at ?? "";
  }, [m.state.taunt, tableId, opp.number, toast]);
  const announced = useRef(false);
  useEffect(() => {
    if (over && !announced.current) {
      announced.current = true;
      if (iWon) chime("success");
    }
  }, [over, iWon]);

  const footer = (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {taunts.map((t) => (
          <button key={t} disabled={busy} onClick={() => act({ action: "taunt", matchId: m.id, text: t })} className="rounded-lg bg-sand-2 px-2 py-1 text-xs hover:bg-line">
            {t}
          </button>
        ))}
      </div>
      {m.state.taunt && (
        <p className="mt-2 rounded-xl border border-indigo-500/30 bg-indigo-50 p-2 text-center text-xs text-indigo-700">
          <b>{m.state.taunt.fromTableId === tableId ? "You" : `Table ${pad(opp.number)}`}:</b> {m.state.taunt.text}
        </p>
      )}
      <div className="mt-3 flex justify-center gap-2">
        {over && <button disabled={busy} onClick={() => act({ action: "rematch", matchId: m.id })} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-extrabold text-white">Rematch</button>}
        <button disabled={busy} onClick={() => act({ action: "leave", matchId: m.id })} className="flex items-center gap-1 rounded-xl border border-line-2 px-3 py-2 text-xs font-bold text-ink-2">
          <LogOut className="size-3.5" /> {over ? "Back to lobby" : "Leave game"}
        </button>
      </div>
    </div>
  );

  const resultText = over ? (draw ? "🤝 Match draw!" : iWon ? `🎉 Table ${pad(tableNumber)} wins!` : `🏆 Table ${pad(opp.number)} wins! Rematch?`) : null;

  if (m.kind === "TTT") {
    const board = m.state.board ?? Array(9).fill("");
    const mine = isHost ? "X" : "O";
    const myTurn = !over && m.state.turn === mine;
    const { line } = winnerOf(board);
    return (
      <GameCard title={`Live: Table ${pad(tableNumber)} vs Table ${pad(opp.number)}`} subtitle={`Tic-Tac-Toe · you are ${mine}`}>
        <Status>{resultText ?? (myTurn ? `Your turn (${mine})` : `Waiting for Table ${pad(opp.number)}…`)}</Status>
        <TttBoard board={board} disabled={!myTurn || busy} highlight={line} onMove={(i) => { chime("tap"); act({ action: "move", matchId: m.id, cell: i }); }} />
        {footer}
      </GameCard>
    );
  }

  const s = m.state;
  const myScore = (isHost ? s.hostScore : s.guestScore) ?? 0;
  const oppScore = (isHost ? s.guestScore : s.hostScore) ?? 0;
  const myMove = isHost ? s.hostMove : s.guestMove;
  const oppMove = isHost ? s.guestMove : s.hostMove;
  const last = s.rounds?.[s.rounds.length - 1];
  const lastMine = last && (isHost ? last.host : last.guest);
  const lastOpp = last && (isHost ? last.guest : last.host);
  const lastResult = last && (last.winner === "draw" ? "Tie round!" : (last.winner === "host") === isHost ? "You won the round!" : "They won the round!");

  return (
    <GameCard title={`Live: Table ${pad(tableNumber)} vs Table ${pad(opp.number)}`} subtitle={`Stone-Paper-Scissors · first to ${s.target ?? 3}`}>
      <Score left={`You · ${myScore}`} mid={`Round ${(s.rounds?.length ?? 0) + (over ? 0 : 1)}`} right={`Table ${pad(opp.number)} · ${oppScore}`} />
      <RpsArena
        leftLabel="You"
        rightLabel={`Table ${pad(opp.number)}`}
        left={myMove && myMove !== "hidden" ? RPS_ICON[myMove] : lastMine ? RPS_ICON[lastMine] : "🤜"}
        right={oppMove ? "✅" : lastOpp && !myMove ? RPS_ICON[lastOpp] : "🤛"}
        leftScore={myScore}
        rightScore={oppScore}
      />
      <p className="mb-3 text-center text-sm font-bold text-brand-600">
        {resultText ?? (myMove ? (oppMove ? "Revealing…" : `Locked in! Waiting for Table ${pad(opp.number)}…`) : oppMove ? "They've picked — your move!" : lastResult ?? "Pick your move!")}
      </p>
      {!over && <RpsButtons disabled={!!myMove || busy} onPick={(r) => act({ action: "move", matchId: m.id, rps: r })} />}
      {footer}
    </GameCard>
  );
}

function ModeBtn({ active, onClick, icon, label, dot }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; dot?: boolean }) {
  return (
    <button onClick={onClick} className={cn("relative flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition", active ? "bg-ink text-white shadow-card" : "text-ink-2 hover:text-ink")}>
      {icon} {label}
      {dot && !active && <span className="absolute right-2 top-1.5 size-2 rounded-full bg-rose-500" />}
    </button>
  );
}

function GamePick({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl p-2.5 text-xs font-bold transition",
        active ? "bg-brand-600 text-white shadow" : "border border-line bg-white text-ink-2 hover:border-brand-500/40",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
