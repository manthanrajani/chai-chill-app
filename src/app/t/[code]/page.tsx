import { Suspense } from "react";
import { LegacyRedirect } from "./legacy-redirect";

/** Old links (/t/78b6mqdn33?tab=games) → new readable links (/table/7/play). */
export default function LegacyTablePage({ params }: PageProps<"/t/[code]">) {
  return (
    <Suspense>
      {params.then(({ code }) => (
        <LegacyRedirect code={code} />
      ))}
    </Suspense>
  );
}
