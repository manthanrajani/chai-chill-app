import { QrCode } from "lucide-react";
import { HomeActions } from "./home-actions";

export default function Home() {
  return (
    <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <div className="pointer-events-none absolute inset-x-0 top-10 mx-auto size-72 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="relative grid size-20 place-items-center rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-500 text-4xl shadow-2xl shadow-orange-900/40">☕</div>
      <h1 className="relative mt-6 font-display text-3xl font-extrabold text-white sm:text-4xl">Chai &amp; Chill Cafe</h1>
      <p className="relative mt-2 text-stone-400">100% Pure Veg • Scan, Order &amp; Play</p>

      <div className="relative mt-10 w-full max-w-md rounded-3xl border border-amber-500/25 bg-espresso-900 p-6">
        <QrCode className="mx-auto size-10 text-amber-400" />
        <h2 className="mt-3 font-display text-lg font-bold text-white">Scan the QR code on your table</h2>
        <p className="mt-1 text-sm text-stone-400">Browse the menu, order straight to the kitchen, call a waiter and play games with your friends while you wait.</p>
        <HomeActions />
      </div>

      <p className="relative mt-8 text-xs text-stone-500">No app to download · Just scan, order &amp; enjoy ☕</p>
    </main>
  );
}
