"use client";

import { useState } from "react";
import useSWR from "swr";
import { Loader2, Save } from "lucide-react";
import { api, fetcher } from "@/lib/client";
import { Btn, Card, Field, PageHeader, Toggle, inputCls } from "@/components/admin-ui";
import { useToast } from "@/components/toast";

type Settings = {
  cafeName: string; tagline: string; address: string; phone: string; gstin: string; pureVeg: boolean; gstRateBp: number;
  wifiSsid: string; wifiPassword: string; upiId: string; timezone: string; acceptingOrders: boolean;
};

export default function SettingsAdmin() {
  const { data, mutate } = useSWR<{ settings: Settings }>("/api/admin/settings", fetcher);
  if (!data) return <div className="h-96 animate-pulse rounded-2xl bg-white" />;
  return <SettingsForm initial={data.settings} onSaved={(settings) => mutate({ settings }, false)} />;
}

function SettingsForm({ initial, onSaved }: { initial: Settings; onSaved: (s: Settings) => void }) {
  const toast = useToast();
  const [f, setF] = useState<Settings>(initial);
  const [gst, setGst] = useState(String(initial.gstRateBp / 100));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setF({ ...f, [k]: v });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { settings } = await api<{ settings: Settings }>("/api/admin/settings", "PATCH", {
        cafeName: f.cafeName, tagline: f.tagline, address: f.address, phone: f.phone, gstin: f.gstin, pureVeg: f.pureVeg,
        gstRateBp: Math.round(Number(gst) * 100), wifiSsid: f.wifiSsid, wifiPassword: f.wifiPassword, upiId: f.upiId,
        timezone: f.timezone, acceptingOrders: f.acceptingOrders,
      });
      setF(settings);
      onSaved(settings);
      toast("Settings saved", { body: "Customers see the changes right away." });
    } catch (err) {
      toast((err as Error).message, { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <PageHeader title="Cafe settings" subtitle="Your cafe details, Wi-Fi, GST and UPI payment." actions={<Btn type="submit" disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save changes</Btn>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Cafe details">
          <div className="grid gap-3">
            <Field label="Cafe name"><input required maxLength={60} value={f.cafeName} onChange={(e) => set("cafeName", e.target.value)} className={inputCls} /></Field>
            <Field label="Tagline (shown under the name)"><input maxLength={100} value={f.tagline} onChange={(e) => set("tagline", e.target.value)} className={inputCls} /></Field>
            <Field label="Address"><input maxLength={200} value={f.address} onChange={(e) => set("address", e.target.value)} className={inputCls} /></Field>
            <Field label="Phone"><input maxLength={30} value={f.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} /></Field>
            <label className="flex items-center gap-2 text-sm font-semibold"><Toggle checked={f.pureVeg} onChange={(v) => set("pureVeg", v)} label="Pure veg" /> 100% pure veg cafe</label>
          </div>
        </Card>
        <Card title="Ordering & payments">
          <div className="grid gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold"><Toggle checked={f.acceptingOrders} onChange={(v) => set("acceptingOrders", v)} label="Accepting orders" /> Accept orders from table QR codes</label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="GST %" hint="5% for most cafes/restaurants"><input type="number" min="0" max="28" step="0.01" value={gst} onChange={(e) => setGst(e.target.value)} className={inputCls} /></Field>
              <Field label="GSTIN (printed on bill)"><input maxLength={20} value={f.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase())} className={inputCls} /></Field>
            </div>
            <Field label="UPI ID for customer payments" hint="Customers get a 'Pay via UPI' button with the exact bill amount. Leave empty to hide."><input maxLength={60} value={f.upiId} onChange={(e) => set("upiId", e.target.value.trim())} placeholder="yourcafe@okaxis" className={inputCls} /></Field>
            <Field label="Timezone" hint="Used for today / this month / this year reports"><input value={f.timezone} onChange={(e) => set("timezone", e.target.value)} className={inputCls} /></Field>
          </div>
        </Card>
        <Card title="Free Wi-Fi for guests">
          <div className="grid gap-3">
            <Field label="Wi-Fi name (SSID)"><input maxLength={60} value={f.wifiSsid} onChange={(e) => set("wifiSsid", e.target.value)} className={inputCls} /></Field>
            <Field label="Wi-Fi password" hint="Shown to customers in the app and printed on table QR cards"><input maxLength={60} value={f.wifiPassword} onChange={(e) => set("wifiPassword", e.target.value)} className={inputCls} /></Field>
          </div>
        </Card>
      </div>
    </form>
  );
}
