import { Suspense } from "react";
import { TablePicker } from "./table-picker";

export default function Home() {
  return (
    <Suspense>
      <TablePicker />
    </Suspense>
  );
}
