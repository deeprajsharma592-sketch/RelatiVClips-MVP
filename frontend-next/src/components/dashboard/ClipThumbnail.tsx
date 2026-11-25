"use client";

import { useEffect, useMemo, useState } from "react";
import type { Clip } from "@/types";
import { apiPath } from "@/lib/apiBase";

function normalizeThumbnailUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  const path = value.startsWith("/") ? value : `/${value}`;
  return path.startsWith("/api/proxy/") ? path : apiPath(path);
}

export default function ClipThumbnail({
  clip,
  sourceUrl,
  alt = "",
  className,
}: {
  clip: Clip | null | undefined;
  sourceUrl?: string;
  alt?: string;
  className: string;
}) {
  const candidates = useMemo(() => {
    const urls = [
      sourceUrl ? normalizeThumbnailUrl(sourceUrl) : "",
      clip?.thumbnail_url ? normalizeThumbnailUrl(clip.thumbnail_url) : "",
      clip?.clip_id ? apiPath(`/thumbnail/${encodeURIComponent(clip.clip_id)}`) : "",
    ];
    return [...new Set(urls.filter(Boolean))];
  }, [sourceUrl, clip?.thumbnail_url, clip?.clip_id]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => setCandidateIndex(0), [candidates]);

  const src = candidates[candidateIndex];
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setCandidateIndex((index) => index + 1)}
    />
  );
}
