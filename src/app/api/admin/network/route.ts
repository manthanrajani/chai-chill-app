import { networkInterfaces } from "os";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

/** This computer's Wi-Fi/LAN addresses — so printed QR codes work on customers' phones. */
export const GET = handle(async (req: Request) => {
  await requireAdmin();
  const port = new URL(req.url).port || req.headers.get("host")?.split(":")[1] || "";
  const ips: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const n of list ?? []) {
      if (n.family === "IPv4" && !n.internal && !n.address.startsWith("169.254.")) ips.push(n.address);
    }
  }
  // prefer typical home/office Wi-Fi ranges first
  ips.sort((a, b) => Number(!a.startsWith("192.168.")) - Number(!b.startsWith("192.168.")));
  return json({ urls: ips.map((ip) => `http://${ip}${port ? `:${port}` : ""}`) });
});
