import { Suspense } from "react";
import { TableApp } from "./table-app";

export default function TablePage({ params }: PageProps<"/t/[code]">) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      {params.then(({ code }) => (
        <TableApp code={code} />
      ))}
    </Suspense>
  );
}

function TableSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-3 px-3 pt-3">
      <div className="h-36 animate-pulse rounded-3xl bg-white" />
      <div className="h-12 animate-pulse rounded-2xl bg-white" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />
      ))}
    </div>
  );
}
