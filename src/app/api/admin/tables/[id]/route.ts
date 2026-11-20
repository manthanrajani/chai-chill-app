import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { newTableCode } from "@/lib/tables";

const schema = z.object({
  label: z.string().trim().max(40).nullable().optional(),
  seats: z.number().int().min(1).max(30).optional(),
  active: z.boolean().optional(),
  /** new QR code — old printed QR stops working */
  regenerateCode: z.boolean().optional(),
});

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/admin/tables/[id]">) => {
  await requireAdmin();
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) throw new ApiError(400, "Bad table id");
  const { regenerateCode, ...data } = schema.parse(await readJson(req));
  if (data.active === false) {
    const open = await db.bill.count({ where: { tableId: id, status: "OPEN" } });
    if (open) throw new ApiError(409, "Settle this table's open bill before disabling it");
  }
  const table = await db.cafeTable.update({
    where: { id },
    data: { ...data, ...(data.label !== undefined && { label: data.label || null }), ...(regenerateCode && { code: newTableCode() }) },
  });
  return json({ table });
});
