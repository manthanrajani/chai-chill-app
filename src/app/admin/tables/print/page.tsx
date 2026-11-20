"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import { fetcher } from "@/lib/client";
import { useBaseUrl } from "@/lib/use-base-url";

type Table = { id: number; number: number; code: string; active: boolean };
type Settings = { cafeName: string; tagline: string; wifiSsid: string; wifiPassword: string };

function wifiEscape(s: string) {
  return s.replace(/([\;,:"])/g, "\\$1");
}

/** Printable table-tent cards: order QR + Wi-Fi QR. */
export default function PrintQr() {
  const tables = useSWR<{ tables: Table[] }>("/api/admin/tables", fetcher);
  const settings = useSWR<{ settings: Settings }>("/api/admin/settings", fetcher);
  const { url: base } = useBaseUrl();
  const [codes, setCodes] = useState<Record<number, string>>({});
  const [wifiQr, setWifiQr] = useState("");
  const s = settings.data?.settings;

  useEffect(() => {
    if (!base || !tables.data) return;
    Promise.all(tables.data.tables.filter((t) => t.active).map(async (t) => [t.id, await QRCode.toDataURL(`${base}/table/${t.number}`, { margin: 1, width: 400 })] as const))
      .then((pairs) => setCodes(Object.fromEntries(pairs)));
  }, [base, tables.data]);
  useEffect(() => {
    if (s?.wifiSsid) QRCode.toDataURL(`WIFI:T:${s.wifiPassword ? "WPA" : "nopass"};S:${wifiEscape(s.wifiSsid)};P:${wifiEscape(s.wifiPassword)};;`, { margin: 1, width: 240 }).then(setWifiQr);
  }, [s]);

  const list = tables.data?.tables.filter((t) => t.active) ?? [];
  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="no-print mb-6 flex items-center justify-between rounded-2xl bg-brand-50 p-4">
        <p className="text-sm text-stone-700">QR codes point to <b>{base}</b>. Cut along the dashed lines.</p>
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 font-bold"><Printer className="size-4" /> Print</button>
      </div>
      <div className="grid grid-cols-2 gap-4 print:gap-0">
        {list.map((t) => (
          <div key={t.id} className="break-inside-avoid rounded-xl border-2 border-dashed border-stone-300 p-5 text-center">
            <div className="text-2xl">☕</div>
            <div className="font-display text-xl font-extrabold">{s?.cafeName}</div>
            <div className="mt-1 inline-block rounded-full bg-stone-900 px-4 py-1 text-lg font-black text-brand-400">TABLE {String(t.number).padStart(2, "0")}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {codes[t.id] && <img src={codes[t.id]} alt="" className="mx-auto mt-3 size-48" />}
            <div className="mt-2 text-sm font-bold">Scan to see menu, order &amp; play games</div>
            <div className="text-xs text-stone-500">No app needed · Pay at the end</div>
            {wifiQr && (
              <div className="mt-3 flex items-center justify-center gap-3 border-t border-stone-200 pt-3 text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={wifiQr} alt="" className="size-16" />
                <div className="text-xs">
                  <div className="font-bold">Free Wi-Fi — scan with camera</div>
                  <div>Network: {s?.wifiSsid}</div>
                  {s?.wifiPassword && <div>Password: {s.wifiPassword}</div>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
