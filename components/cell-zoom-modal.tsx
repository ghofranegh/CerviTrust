'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { classMeta, TONE_BADGE, toPercent, type RegionOfInterest } from '@/lib/analysis-types';

/**
 * Zoomed, cropped view of one detected cell — a quick popup instead of
 * jumping back into the Segmentation tab. Closes on the X, on Escape, or on
 * a click outside the image.
 */
export function CellZoomModal({ roi, onClose }: { roi: RegionOfInterest; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const meta = classMeta(roi.predicted_class);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="relative flex max-h-[85vh] max-w-[min(90vw,560px)] flex-col items-center" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-foreground shadow-lg hover:bg-secondary"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <div className="overflow-hidden rounded-xl border-4 border-white bg-white shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${roi.image}`}
            alt={`Cell ${roi.id} — ${meta.label}`}
            className="block h-auto max-h-[70vh] w-auto max-w-full"
            style={{ imageRendering: 'auto' }}
          />
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 shadow">
          <span className="text-sm font-medium text-foreground">Cell #{roi.id}</span>
          <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${TONE_BADGE[meta.tone]}`}>{meta.label}</span>
          <span className="text-xs text-foreground/60">{toPercent(roi.confidence, 1)} calibrated</span>
        </div>
      </div>
    </div>
  );
}
