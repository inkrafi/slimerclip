"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useCopy } from "@/components/LocaleProvider";

const COPY = {
  id: { empty: "Tempel link video YouTube dulu.", label: "Link video YouTube", reading: "Membaca transkrip…", find: "Cari momen" },
  en: { empty: "Paste a YouTube video link first.", label: "YouTube video link", reading: "Reading transcript…", find: "Find moments" },
};

interface Props {
  /** Kembalikan pesan error untuk ditampilkan di bawah kolom, atau kosong jika valid */
  onSubmit: (url: string) => string | void;
  isLoading: boolean;
  size?: "lg" | "md";
}

export default function AnalyzeForm({ onSubmit, isLoading, size = "md" }: Props) {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const t = useCopy(COPY);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setUrlError(t.empty);
      return;
    }
    const error = onSubmit(url.trim());
    if (error) {
      setUrlError(error);
      return;
    }
    setUrlError("");
    setUrl("");
  };

  const height = size === "lg" ? "h-14" : "h-11";

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col sm:flex-row gap-2">
        <label className={`field flex-1 ${height} ${urlError ? "border-tally" : ""}`}>
          <span className="sr-only">{t.label}</span>
          <input
            type="url"
            inputMode="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            onChange={e => {
              setUrl(e.target.value);
              if (urlError) setUrlError("");
            }}
            disabled={isLoading}
            aria-invalid={!!urlError}
            aria-describedby={urlError ? "url-error" : undefined}
            className={`w-full bg-transparent outline-none text-ink placeholder:text-ink-faint disabled:opacity-50 ${size === "lg" ? "text-base" : "text-sm"}`}
          />
        </label>

        <button type="submit" disabled={isLoading} className={`btn btn-primary ${height} px-6`}>
          {isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t.reading}
            </>
          ) : (
            t.find
          )}
        </button>
      </div>

      {urlError && (
        <p id="url-error" className="mt-2 text-sm text-tally">
          {urlError}
        </p>
      )}
    </form>
  );
}
