"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function ProcessRedirect() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const q = params.toString();
    router.replace(q ? `/dashboard?${q}` : "/dashboard");
  }, [params, router]);

  return (
    <div className="min-h-[calc(100vh-140px)] flex flex-col items-center justify-center gap-3 text-zinc-400">
      <Loader2 className="w-6 h-6 animate-spin text-white" />
      <span className="text-xs font-mono">Opening your studio dashboard...</span>
    </div>
  );
}

export default function ProcessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      }
    >
      <ProcessRedirect />
    </Suspense>
  );
}
