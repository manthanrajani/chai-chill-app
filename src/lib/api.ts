import "server-only";
import { NextResponse, connection } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./errors";

export { ApiError };

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler: always dynamic, consistent JSON errors. */
export function handle<C>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    await connection();
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) return json({ error: err.message }, { status: err.status });
      if (err instanceof ZodError) {
        const msg = err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
        return json({ error: msg }, { status: 400 });
      }
      console.error("[api]", err);
      return json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
}
