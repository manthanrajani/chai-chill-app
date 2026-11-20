-- Guarantee a table can only have ONE open bill at a time (prevents duplicate bills when two phones order together)
CREATE UNIQUE INDEX "Bill_one_open_per_table" ON "Bill" ("tableId") WHERE "status" = 'OPEN';
