import React, { useEffect, useState } from "react";
import { Globe2 } from "lucide-react";
import { api } from "./client";
import { readInspection, technologyKey, type Inspection } from "./site-technology";

const validIcon = (value: unknown): value is string => typeof value === "string" && value.length <= 180000 && /^data:image\/(?:png|x-icon|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
const pending = new Map<string, Promise<Inspection>>();
export default function SiteFavicon({ url }: { url?: string; icon?: string }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    let disposed = false; setImage("");
    if (!url) return;
    let key: string;
    try { if ((new URL(url).hostname === "sample.example" || new URL(url).hostname === "127.0.0.1" && new URL(url).pathname.startsWith("/fixture"))) return; key = technologyKey(url); } catch { return; }
    try { const cached = readInspection(localStorage.getItem(key), url); if (cached && Object.hasOwn(cached, "favicon")) { if (validIcon(cached.favicon)) setImage(cached.favicon); return; } } catch {}
    let request = pending.get(key);
    if (!request) { request = api<Inspection>("/api/technology", { url }); pending.set(key, request); request.finally(() => pending.delete(key)).catch(() => {}); }
    request.then(result => {
      if (disposed) return;
      if (validIcon(result.favicon)) setImage(result.favicon);
      try { localStorage.setItem(key, JSON.stringify(result)); } catch {}
    }).catch(() => {});
    return () => { disposed = true; };
  }, [url]);
  return image ? <img className="site-favicon" src={image} alt="" width="20" height="20" referrerPolicy="no-referrer" onError={() => setImage("")} /> : <Globe2 size={17} aria-hidden="true" />;
}
