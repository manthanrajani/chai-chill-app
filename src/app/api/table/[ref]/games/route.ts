import { z } from "zod";
import { handle, json, readJson } from "@/lib/api";
import { getTable } from "@/lib/orders";
import { challenge, getLobby, leave, move, rematch, respond, taunt, type RpsState } from "@/lib/games";

type Lobby = Awaited<ReturnType<typeof getLobby>>;

/** Never reveal the opponent's secret Stone-Paper-Scissors pick before both have chosen. */
function sanitize(lobby: Lobby) {
  const m = lobby.current;
  if (!m || m.kind !== "RPS") return lobby;
  const s = m.state as unknown as RpsState;
  const isHost = m.hostTableId === lobby.tableId;
  const safe = {
    ...s,
    hostMove: isHost ? s.hostMove : s.hostMove ? "hidden" : null,
    guestMove: isHost ? (s.guestMove ? "hidden" : null) : s.guestMove,
  };
  return { ...lobby, current: { ...m, state: safe } };
}

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/table/[ref]/games">) => {
  const { ref: code } = await ctx.params;
  const table = await getTable(code);
  return json(sanitize(await getLobby(table.id)));
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("challenge"), opponentTableId: z.number().int(), kind: z.enum(["TTT", "RPS"]) }),
  z.object({ action: z.literal("respond"), matchId: z.string(), accept: z.boolean() }),
  z.object({ action: z.literal("move"), matchId: z.string(), cell: z.number().int().optional(), rps: z.enum(["rock", "paper", "scissors"]).optional() }),
  z.object({ action: z.literal("taunt"), matchId: z.string(), text: z.string().max(40) }),
  z.object({ action: z.literal("leave"), matchId: z.string() }),
  z.object({ action: z.literal("rematch"), matchId: z.string() }),
]);

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/table/[ref]/games">) => {
  const { ref: code } = await ctx.params;
  const table = await getTable(code);
  const body = schema.parse(await readJson(req));
  switch (body.action) {
    case "challenge": await challenge(table.id, body.opponentTableId, body.kind); break;
    case "respond": await respond(body.matchId, table.id, body.accept); break;
    case "move": await move(body.matchId, table.id, { cell: body.cell, rps: body.rps }); break;
    case "taunt": await taunt(body.matchId, table.id, body.text); break;
    case "leave": await leave(body.matchId, table.id); break;
    case "rematch": await rematch(body.matchId, table.id); break;
  }
  return json(sanitize(await getLobby(table.id)));
});
