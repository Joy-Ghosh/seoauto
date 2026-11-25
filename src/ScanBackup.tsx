import React, { useRef, useState } from "react";
import { ArrowDownToLine, Upload } from "lucide-react";
import { hosted } from "./client";
import { localDb } from "./local-db";
import { scanSchema } from "./scan-schema";
import type { Scan, Repair } from "./types";
export default function ScanBackup({
  scan,
  repairs,
  imported,
}: {
  scan: Scan | null;
  repairs: Repair[];
  imported: (scan: Scan) => void;
}) {
  const [error, setError] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  function download() {
    if (!scan) return;
    const data = {
      schema: "seo-workbench-scan/v1",
      exportedAt: new Date().toISOString(),
      scan,
      repairs,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "seo-scan-backup.json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    try {
      if (file.size > 25_000_000)
        throw new Error("Choose a scan backup under 25 MB.");
      const value = JSON.parse(await file.text());
      if (value.schema !== "seo-workbench-scan/v1")
        throw new Error("Choose a SEO Workbench scan backup.");
      const result = scanSchema.safeParse(value.scan);
      if (!result.success)
        throw new Error("This backup contains invalid scan data.");
      if (result.data.status === "running") result.data.status = "cancelled";
      const exists = await localDb.scan(result.data.id);
      if (exists) {
        imported(exists);
        return;
      }
      await localDb.saveScan(result.data);
      const allowed = new Set(result.data.pages.map((page) => page.url));
      const drafts = Array.isArray(value.repairs)
        ? value.repairs
            .filter(
              (r: any) =>
                r &&
                allowed.has(r.url) &&
                ["title", "meta_description", "alt_text"].includes(r.field) &&
                typeof r.original === "string" &&
                typeof r.value === "string" &&
                r.value.length <= 2000,
            )
            .slice(0, 200)
            .map((r: any) => ({
              id:
                r.url +
                r.field +
                (r.field === "alt_text" && typeof r.imageSrc === "string"
                  ? r.imageSrc
                  : ""),
              url: r.url,
              field: r.field,
              original: r.original.slice(0, 6000),
              value: r.value,
              ...(r.field === "alt_text" && typeof r.imageSrc === "string"
                ? { imageSrc: r.imageSrc }
                : {}),
            }))
        : [];
      localStorage.setItem("repairs:" + result.data.id, JSON.stringify(drafts));
      imported(result.data);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="scan-backup">
      <div>
        <strong>Your scan, portable.</strong>
        <small>
          Export a backup before clearing browser data, or move a local scan to
          your hosted workspace. Backups never contain API keys.
        </small>
      </div>
      <div className="scan-backup-actions">
        <button
          className="button secondary"
          disabled={!scan || scan.status === "running"}
          onClick={download}
        >
          <ArrowDownToLine size={15} /> Backup scan
        </button>
        {hosted && (
          <>
            <button
              className="button secondary"
              onClick={() => picker.current?.click()}
            >
              <Upload size={15} /> Import scan
            </button>
            <input
              ref={picker}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
