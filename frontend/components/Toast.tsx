"use client";

import { useEffect } from "react";

export interface ToastData {
  id: number;
  message: string;
}

/** Brief confirmation that an action worked; dismisses itself after a few seconds. */
export default function Toast({ toast, onClose }: { toast: ToastData | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div
        key={toast.id}
        role="status"
        className="pointer-events-auto flex max-w-full animate-fade-up items-center gap-3 [overflow-wrap:anywhere] rounded-full bg-ink py-3 pl-4 pr-5 text-sm font-medium text-white shadow-pop"
      >
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="h-5 w-5 rounded-full bg-lime p-0.5 text-lime-deep"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m4.5 10.5 3.5 3.5 7.5-8" />
        </svg>
        {toast.message}
      </div>
    </div>
  );
}
