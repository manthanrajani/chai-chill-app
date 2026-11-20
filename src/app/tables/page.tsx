import { Suspense } from "react";
import type { Metadata } from "next";
import { TablePicker } from "../table-picker";

export const metadata: Metadata = { title: "Choose your table" };

/** /tables — always shows the "Which table are you at?" grid. */
export default function ChooseTablePage() {
  return (
    <Suspense>
      <TablePicker forcePick />
    </Suspense>
  );
}
