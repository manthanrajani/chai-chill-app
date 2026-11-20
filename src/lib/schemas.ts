import { z } from "zod";

// Base shapes have no defaults so `.partial()` updates never overwrite fields that weren't sent.
const categoryBase = z.object({
  name: z.string().trim().min(1).max(40),
  emoji: z.string().trim().min(1).max(8),
  sortOrder: z.number().int().min(0).max(999),
  active: z.boolean(),
});
export const categoryCreateSchema = categoryBase.extend({
  emoji: categoryBase.shape.emoji.default("🍽️"),
  sortOrder: categoryBase.shape.sortOrder.default(0),
  active: categoryBase.shape.active.default(true),
});
export const categoryUpdateSchema = categoryBase.partial();

const menuItemBase = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300),
  pricePaise: z.number().int().min(0).max(10_000_000),
  emoji: z.string().trim().min(1).max(8),
  imageUrl: z.union([z.string().trim().url().max(500), z.literal("").transform(() => null), z.null()]),
  isVeg: z.boolean(),
  tags: z.array(z.string().trim().min(1).max(20)).max(5),
  available: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
  categoryId: z.string().min(1),
});
export const menuItemCreateSchema = menuItemBase.extend({
  description: menuItemBase.shape.description.default(""),
  emoji: menuItemBase.shape.emoji.default("🍽️"),
  imageUrl: menuItemBase.shape.imageUrl.optional(),
  isVeg: menuItemBase.shape.isVeg.default(true),
  tags: menuItemBase.shape.tags.default([]),
  available: menuItemBase.shape.available.default(true),
  sortOrder: menuItemBase.shape.sortOrder.default(0),
});
export const menuItemUpdateSchema = menuItemBase.partial();
