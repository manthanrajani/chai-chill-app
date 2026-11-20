import "server-only";
import { db } from "./db";
import { ApiError } from "./errors";
import { ONLINE_WINDOW_MS } from "./tables";
import type { GameKind } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/** Fixed reaction list — no free-text chat between strangers' tables. */
export const TAUNTS = ["🔥 Kya chaal hai!", "😂 Easy win!", "☕ Chai pe milte hain!", "😱 Bach gaya!", "👏 Well played!", "😎 Rematch?"];

export type TttState = { board: ("" | "X" | "O")[]; turn: "X" | "O"; taunt?: Taunt | null };
export type RpsMove = "rock" | "paper" | "scissors";
export type RpsState = {
  target: number;
  hostMove: RpsMove | null;
  guestMove: RpsMove | null;
  hostScore: number;
  guestScore: number;
  rounds: { host: RpsMove; guest: RpsMove; winner: "host" | "guest" | "draw" }[];
  taunt?: Taunt | null;
};
type Taunt = { fromTableId: number; text: string; at: string };

const PENDING_TTL_MS = 2 * 60_000;
const ACTIVE_IDLE_TTL_MS = 10 * 60_000;

export function tttWinner(b: TttState["board"]): "X" | "O" | "DRAW" | null {
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  for (const [a, c, d] of lines) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a] as "X" | "O";
  return b.every(Boolean) ? "DRAW" : null;
}

function rpsBeats(a: RpsMove, b: RpsMove) {
  return (a === "rock" && b === "scissors") || (a === "paper" && b === "rock") || (a === "scissors" && b === "paper");
}

function initialState(kind: GameKind): TttState | RpsState {
  return kind === "TTT"
    ? { board: Array(9).fill(""), turn: "X", taunt: null }
    : { target: 3, hostMove: null, guestMove: null, hostScore: 0, guestScore: 0, rounds: [], taunt: null };
}

/** Lazily expire stale challenges/matches so abandoned games never block a table. */
async function expireStale() {
  const now = Date.now();
  await db.gameMatch.updateMany({
    where: { status: "PENDING", createdAt: { lt: new Date(now - PENDING_TTL_MS) } },
    data: { status: "CANCELLED" },
  });
  await db.gameMatch.updateMany({
    where: { status: "ACTIVE", updatedAt: { lt: new Date(now - ACTIVE_IDLE_TTL_MS) } },
    data: { status: "CANCELLED" },
  });
}

const tableSelect = { select: { id: true, number: true, label: true } } as const;

export async function getLobby(tableId: number) {
  await expireStale();
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const [online, incoming, outgoing, current] = await Promise.all([
    db.cafeTable.findMany({
      where: { active: true, id: { not: tableId }, lastSeenAt: { gte: since } },
      select: { id: true, number: true, label: true },
      orderBy: { number: "asc" },
    }),
    db.gameMatch.findMany({
      where: { guestTableId: tableId, status: "PENDING" },
      include: { hostTable: tableSelect },
      orderBy: { createdAt: "desc" },
    }),
    db.gameMatch.findFirst({
      where: { hostTableId: tableId, status: "PENDING" },
      include: { guestTable: tableSelect },
      orderBy: { createdAt: "desc" },
    }),
    // the active match, or one that just finished/declined (so both sides see the result)
    db.gameMatch.findFirst({
      where: {
        OR: [{ hostTableId: tableId }, { guestTableId: tableId }],
        AND: [
          {
            OR: [
              { status: "ACTIVE" },
              { status: { in: ["FINISHED", "DECLINED"] }, updatedAt: { gte: new Date(Date.now() - 90_000) } },
            ],
          },
        ],
      },
      include: { hostTable: tableSelect, guestTable: tableSelect },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  return { tableId, online, incoming, outgoing, current, taunts: TAUNTS };
}

export async function challenge(tableId: number, opponentTableId: number, kind: GameKind) {
  if (opponentTableId === tableId) throw new ApiError(400, "You can't challenge your own table");
  const opp = await db.cafeTable.findUnique({ where: { id: opponentTableId } });
  if (!opp || !opp.active) throw new ApiError(404, "Table not found");
  if (!opp.lastSeenAt || Date.now() - opp.lastSeenAt.getTime() > ONLINE_WINDOW_MS) {
    throw new ApiError(409, `Table ${opp.number} just went offline`);
  }
  const busy = await db.gameMatch.findFirst({
    where: { status: "ACTIVE", OR: [{ hostTableId: opponentTableId }, { guestTableId: opponentTableId }] },
  });
  if (busy) throw new ApiError(409, `Table ${opp.number} is already in a game. Try again in a bit!`);
  // one outgoing challenge at a time; leave any active match
  await db.gameMatch.updateMany({
    where: {
      OR: [
        { hostTableId: tableId, status: "PENDING" },
        { status: "ACTIVE", OR: [{ hostTableId: tableId }, { guestTableId: tableId }] },
      ],
    },
    data: { status: "CANCELLED" },
  });
  return db.gameMatch.create({
    data: { kind, hostTableId: tableId, guestTableId: opponentTableId, state: initialState(kind) as Prisma.InputJsonValue },
  });
}

async function loadForTable(matchId: string, tableId: number) {
  const m = await db.gameMatch.findUnique({ where: { id: matchId } });
  if (!m || (m.hostTableId !== tableId && m.guestTableId !== tableId)) throw new ApiError(404, "Game not found");
  return m;
}

/** Optimistic concurrency: only write if nobody else updated the match since we read it. */
async function saveIfUnchanged(
  m: { id: string; updatedAt: Date },
  data: Prisma.GameMatchUpdateManyMutationInput,
) {
  const res = await db.gameMatch.updateMany({ where: { id: m.id, updatedAt: m.updatedAt }, data });
  if (res.count === 0) throw new ApiError(409, "The game changed — refreshing…");
}

export async function respond(matchId: string, tableId: number, accept: boolean) {
  const m = await loadForTable(matchId, tableId);
  if (m.guestTableId !== tableId) throw new ApiError(403, "Only the challenged table can respond");
  if (m.status !== "PENDING") throw new ApiError(409, "This challenge has expired");
  if (accept) {
    // leaving any other game we were in
    await db.gameMatch.updateMany({
      where: { id: { not: m.id }, status: { in: ["ACTIVE", "PENDING"] }, OR: [{ hostTableId: tableId }, { guestTableId: tableId }] },
      data: { status: "CANCELLED" },
    });
  }
  await saveIfUnchanged(m, { status: accept ? "ACTIVE" : "DECLINED" });
}

export async function move(matchId: string, tableId: number, payload: { cell?: number; rps?: RpsMove }) {
  const m = await loadForTable(matchId, tableId);
  if (m.status !== "ACTIVE") throw new ApiError(409, "This game is over");
  const isHost = m.hostTableId === tableId;

  if (m.kind === "TTT") {
    const s = m.state as unknown as TttState;
    const mySymbol = isHost ? "X" : "O";
    if (s.turn !== mySymbol) throw new ApiError(409, "Wait for your turn");
    const cell = payload.cell;
    if (cell === undefined || !Number.isInteger(cell) || cell < 0 || cell > 8 || s.board[cell]) {
      throw new ApiError(400, "Pick an empty square");
    }
    const board = [...s.board];
    board[cell] = mySymbol;
    const w = tttWinner(board);
    const next: TttState = { ...s, board, turn: mySymbol === "X" ? "O" : "X" };
    await saveIfUnchanged(m, {
      state: next as unknown as Prisma.InputJsonValue,
      ...(w && {
        status: "FINISHED",
        winnerTableId: w === "DRAW" ? null : w === "X" ? m.hostTableId : m.guestTableId,
      }),
    });
    return;
  }

  const s = m.state as unknown as RpsState;
  const mv = payload.rps;
  if (!mv || !["rock", "paper", "scissors"].includes(mv)) throw new ApiError(400, "Pick stone, paper or scissors");
  if ((isHost ? s.hostMove : s.guestMove) !== null) throw new ApiError(409, "Waiting for the other table to choose");
  const next: RpsState = { ...s, [isHost ? "hostMove" : "guestMove"]: mv };
  let finished = false;
  let winner: number | null = null;
  if (next.hostMove && next.guestMove) {
    const h = next.hostMove;
    const g = next.guestMove;
    const rw = h === g ? "draw" : rpsBeats(h, g) ? "host" : "guest";
    next.rounds = [...next.rounds, { host: h, guest: g, winner: rw }];
    if (rw === "host") next.hostScore++;
    if (rw === "guest") next.guestScore++;
    next.hostMove = null;
    next.guestMove = null;
    if (next.hostScore >= next.target || next.guestScore >= next.target) {
      finished = true;
      winner = next.hostScore > next.guestScore ? m.hostTableId : m.guestTableId;
    }
  }
  await saveIfUnchanged(m, {
    state: next as unknown as Prisma.InputJsonValue,
    ...(finished && { status: "FINISHED", winnerTableId: winner }),
  });
}

export async function taunt(matchId: string, tableId: number, text: string) {
  if (!TAUNTS.includes(text)) throw new ApiError(400, "Unknown reaction");
  const m = await loadForTable(matchId, tableId);
  if (m.status !== "ACTIVE" && m.status !== "FINISHED") throw new ApiError(409, "Game is not running");
  const s = m.state as Record<string, unknown>;
  await saveIfUnchanged(m, {
    state: { ...s, taunt: { fromTableId: tableId, text, at: new Date().toISOString() } } as Prisma.InputJsonValue,
  });
}

export async function leave(matchId: string, tableId: number) {
  const m = await loadForTable(matchId, tableId);
  if (m.status === "PENDING" || m.status === "ACTIVE") {
    await db.gameMatch.update({ where: { id: m.id }, data: { status: "CANCELLED" } });
  }
}

export async function rematch(matchId: string, tableId: number) {
  const m = await loadForTable(matchId, tableId);
  const opponent = m.hostTableId === tableId ? m.guestTableId : m.hostTableId;
  return challenge(tableId, opponent, m.kind);
}
