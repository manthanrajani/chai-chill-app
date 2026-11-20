import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TableApp, type Section } from "../table-app";

const SECTIONS: Section[] = ["menu", "orders", "play", "waiter", "bill", "wifi"];

/** /table/7 · /table/7/orders · /table/7/play · /table/7/waiter · /table/7/bill · /table/7/wifi */
export default function TablePage({ params }: PageProps<"/table/[number]/[[...section]]">) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      {params.then(({ number, section }) => {
        const n = Number(number);
        const s = (section?.[0] ?? "menu") as Section;
        if (!Number.isInteger(n) || n < 1 || n > 9999 || (section && section.length > 1) || !SECTIONS.includes(s)) notFound();
        return <TableApp code={String(n)} section={s} />;
      })}
    </Suspense>
  );
}

function TableSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-3 px-4 pt-16">
      <div className="skeleton h-44 rounded-[28px]" />
      <div className="skeleton h-11 rounded-full" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-32 rounded-3xl" />
      ))}
    </div>
  );
}
