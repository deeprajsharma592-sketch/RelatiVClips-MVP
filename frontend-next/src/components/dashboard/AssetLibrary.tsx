"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Film, ImageIcon, Music, Upload } from "lucide-react";

type Asset = { id: string; owner: string; file: File; addedAt: number };
const maxFileSize = 100 * 1024 * 1024;

async function accessAssets<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("relativ-asset-library", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("assets", { keyPath: "id" }).createIndex("owner", "owner");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction("assets", mode);
      transaction.onabort = () => reject(transaction.error);
      const request = operation(transaction.objectStore("assets"));
      transaction.oncomplete = () => resolve(request.result);
    });
  } finally {
    db.close();
  }
}

function AssetCard({ asset }: { asset: Asset }) {
  const { file } = asset;
  const [url, setUrl] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setUrl(objectUrl); });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#121215]">
      <div className="grid aspect-video place-items-center bg-black/40 text-zinc-400">
        {url && isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-contain" />
        ) : url && isVideo ? (
          <video src={url} controls preload="metadata" aria-label={file.name} className="h-full w-full object-contain" />
        ) : url && file.type.startsWith("audio/") ? (
          <audio src={url} controls preload="none" aria-label={file.name} className="w-11/12" />
        ) : <Film aria-hidden="true" />}
      </div>
      <div className="flex items-center gap-2 p-3">
        <p title={file.name} className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</p>
        {url && (
          <a href={url} download={file.name} aria-label={`Download ${file.name}`} className="rounded-lg p-2 text-zinc-300 hover:bg-white/10">
            <Download className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </div>
    </article>
  );
}

export default function AssetLibrary({ owner }: { owner: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    accessAssets("readonly", (store) => store.index("owner").getAll(owner))
      .then((items: Asset[]) => {
        if (!cancelled) setAssets(items.sort((a, b) => b.addedAt - a.addedAt));
      })
      .catch(() => { if (!cancelled) setNotice("Couldn’t open your saved assets in this browser."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [owner]);

  async function addFiles(files: File[]) {
    if (loading || saving || !files.length) return;
    setSaving(true);
    const saved: Asset[] = [];
    const errors: string[] = [];
    for (const file of files) {
      if (!/^(image|video|audio)\//.test(file.type) || !file.size || file.size > maxFileSize) {
        errors.push(`${file.name} must be a nonempty image, audio, or video file up to 100 MB.`);
        continue;
      }
      const asset = { owner, file, id: crypto.randomUUID(), addedAt: Date.now() };
      try {
        await accessAssets("readwrite", (store) => store.add(asset));
        saved.push(asset);
      } catch {
        errors.push(`Couldn’t save ${file.name} in this browser.`);
      }
    }
    setAssets((current) => [...saved.reverse(), ...current]);
    setNotice([...errors, ...(saved.length ? [`Added ${saved.length} ${saved.length === 1 ? "asset" : "assets"}.`] : [])].join(" "));
    setSaving(false);
  }

  return (
    <section className="space-y-5" aria-labelledby="asset-library-title">
      <header>
        <h2 id="asset-library-title" className="text-2xl font-semibold text-white">Asset &amp; B-roll Library</h2>
        <p className="mt-1 text-sm text-zinc-400">Keep memes, sound effects, and B-roll together. Files are saved in this browser.</p>
      </header>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = loading || saving ? "none" : "copy";
          setDragging(!loading && !saving);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void addFiles(Array.from(event.dataTransfer.files));
        }}
        className={`flex flex-col items-center gap-3 rounded-2xl border border-dashed px-5 py-10 text-center ${dragging ? "border-amber-300 bg-amber-300/10" : "border-white/20 bg-[#121215]"}`}
      >
        <div className="flex items-center gap-3 text-amber-300" aria-hidden="true">
          <ImageIcon className="h-5 w-5" />
          <Film className="h-5 w-5" />
          <Music className="h-5 w-5" />
        </div>
        <p className="font-semibold">Drag and drop assets here</p>
        <p className="text-sm text-zinc-400">Images, GIFs, audio, and video · Up to 100 MB per file</p>
        <input
          ref={input}
          type="file"
          accept="image/*,audio/*,video/*"
          multiple
          hidden
          onChange={(event) => {
            void addFiles(Array.from(event.currentTarget.files ?? []));
            event.currentTarget.value = "";
          }}
        />
        <button type="button" disabled={loading || saving} onClick={() => input.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-200 disabled:opacity-50">
          <Upload className="h-4 w-4" aria-hidden="true" />
          {saving ? "Adding assets…" : "Upload assets"}
        </button>
      </div>
      <p role="status" className="break-words text-sm text-zinc-300 empty:hidden">{notice}</p>
      {assets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assets.map((asset) => <AssetCard key={asset.id} asset={asset} />)}
        </div>
      )}
    </section>
  );
}
