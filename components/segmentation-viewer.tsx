'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { MeterBar } from '@/components/charts';
import {
  Anomaly,
  RegionOfInterest,
  SegmentationData,
  SegmentationStats,
  TONE_BADGE,
  classMeta,
  formatNumber,
  severityLabel,
  severityTone,
  toPercent,
} from '@/lib/analysis-types';

const NUCLEUS_COLOR = '#7E3F9D';
const CYTOPLASM_COLOR = '#1D8F8F';

/**
 * The backend returns binary white-on-black masks. Browsers can't tint those
 * reliably with CSS blend modes, so the mask is redrawn on a canvas with its
 * luminance used as the alpha channel — giving a real translucent colour layer.
 */
function useTintedMask(base64: string | undefined, color: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!base64) {
      setUrl(null);
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = data.data;
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      for (let i = 0; i < pixels.length; i += 4) {
        const luminance = (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) / 255;
        pixels[i] = r;
        pixels[i + 1] = g;
        pixels[i + 2] = b;
        pixels[i + 3] = Math.round(luminance * 255);
      }
      context.putImageData(data, 0, 0);
      setUrl(canvas.toDataURL('image/png'));
    };
    image.src = `data:image/png;base64,${base64}`;

    return () => {
      cancelled = true;
    };
  }, [base64, color]);

  return url;
}

function AnomalyRow({ anomaly }: { anomaly: Anomaly }) {
  const tone = severityTone(anomaly.severity);
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 min-w-0">
        <span
          className={`h-2 w-2 rounded-full flex-shrink-0 ${
            tone === 'critical' ? 'bg-status-critical' : tone === 'warning' ? 'bg-status-warning' : 'bg-muted-foreground'
          }`}
        />
        <span className="text-foreground/80 truncate">{anomaly.label}</span>
      </span>
      <span className={`rounded-md border px-2 py-0.5 text-xs font-medium flex-shrink-0 ${TONE_BADGE[tone]}`}>
        {severityLabel(anomaly.severity)}
      </span>
    </li>
  );
}

export function SegmentationViewer({
  previewSrc,
  segmentation,
  stats,
  regions,
  selectedId,
  onSelect,
}: {
  previewSrc: string | null;
  segmentation?: SegmentationData;
  stats?: SegmentationStats;
  regions: RegionOfInterest[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const [showNucleus, setShowNucleus] = useState(true);
  const [showCytoplasm, setShowCytoplasm] = useState(true);
  const [showContours, setShowContours] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [opacity, setOpacity] = useState(0.55);

  const nucleusUrl = useTintedMask(segmentation?.nucleus, NUCLEUS_COLOR);
  const cytoplasmUrl = useTintedMask(segmentation?.cytoplasm, CYTOPLASM_COLOR);

  const selectedIndex = useMemo(() => {
    const index = regions.findIndex((roi) => roi.id === selectedId);
    return index >= 0 ? index : 0;
  }, [regions, selectedId]);

  const selected = regions[selectedIndex];
  const morphometrics = selected?.morphometrics;

  const step = (delta: number) => {
    if (!regions.length) return;
    const next = (selectedIndex + delta + regions.length) % regions.length;
    onSelect(regions[next].id);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Viewer */}
      <div className="xl:col-span-2 rounded-lg border border-border bg-white overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border p-4 bg-secondary/30">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Masks</span>
            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <input type="checkbox" checked={showNucleus} onChange={(e) => setShowNucleus(e.target.checked)} />
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: NUCLEUS_COLOR }} />
              Nucleus
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <input type="checkbox" checked={showCytoplasm} onChange={(e) => setShowCytoplasm(e.target.checked)} />
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: CYTOPLASM_COLOR }} />
              Cytoplasm
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground/80">
            <input type="checkbox" checked={showContours} onChange={(e) => setShowContours(e.target.checked)} />
            Contours
          </label>

          <label className="flex items-center gap-2 text-sm text-foreground/80">
            <input type="checkbox" checked={showMarkers} onChange={(e) => setShowMarkers(e.target.checked)} />
            Instance labels
          </label>

          <label className="flex items-center gap-3 text-sm text-foreground/80 ml-auto">
            Opacity
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(opacity * 100)}
              onChange={(e) => setOpacity(Number(e.target.value) / 100)}
              className="w-28 accent-[var(--primary)]"
            />
            <span className="tabular-nums w-10 text-right">{Math.round(opacity * 100)}%</span>
          </label>
        </div>

        {/* w-fit keeps the wrapper exactly the size of the rendered image, so the
            mask layers and the instance markers stay pixel-aligned with it. */}
        <div className="relative mx-auto w-fit bg-foreground/5">
          {showContours && segmentation?.overlay ? (
            <img src={`data:image/png;base64,${segmentation.overlay}`} alt="Nucleus contours" className="block max-h-[520px] w-auto max-w-full" />
          ) : previewSrc ? (
            <img src={previewSrc} alt="Uploaded cytology field" className="block max-h-[520px] w-auto max-w-full" />
          ) : (
            <div className="h-64 w-64" />
          )}

          {showCytoplasm && cytoplasmUrl ? (
            <img src={cytoplasmUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full pointer-events-none" style={{ opacity }} />
          ) : null}
          {showNucleus && nucleusUrl ? (
            <img src={nucleusUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full pointer-events-none" style={{ opacity }} />
          ) : null}

          {showMarkers &&
            regions.map((roi) =>
              roi.position_pct ? (
                <button
                  key={roi.id}
                  type="button"
                  onClick={() => onSelect(roi.id)}
                  style={{ left: `${roi.position_pct[0]}%`, top: `${roi.position_pct[1]}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-all ${
                    roi.id === selected?.id
                      ? 'border-primary bg-primary text-white scale-110'
                      : 'border-white bg-foreground/70 text-white hover:bg-primary'
                  }`}
                  title={`Instance ${roi.id} — ${classMeta(roi.predicted_class).label}`}
                >
                  {roi.id}
                </button>
              ) : null,
            )}
        </div>

        {/* Instance strip */}
        {regions.length > 0 ? (
          <div className="border-t border-border p-4">
            <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-3">
              Detected instances ({regions.length})
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {regions.map((roi) => (
                <button
                  key={roi.id}
                  type="button"
                  onClick={() => onSelect(roi.id)}
                  className={`flex-shrink-0 rounded-lg border p-1.5 transition-all ${
                    roi.id === selected?.id ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40'
                  }`}
                >
                  <img src={`data:image/png;base64,${roi.image}`} alt={`Instance ${roi.id}`} className="h-16 w-16 rounded object-cover bg-white" />
                  <span className="mt-1 block text-center text-[11px] text-foreground/70">{roi.id}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Instance details */}
      <div className="rounded-lg border border-border bg-white p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-semibold text-foreground">Instance details</h4>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => step(-1)} disabled={regions.length < 2} className="rounded-md border border-border p-1.5 disabled:opacity-40" aria-label="Previous instance">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-foreground/70 tabular-nums px-1">
              {regions.length ? `${selectedIndex + 1} / ${regions.length}` : '0 / 0'}
            </span>
            <button type="button" onClick={() => step(1)} disabled={regions.length < 2} className="rounded-md border border-border p-1.5 disabled:opacity-40" aria-label="Next instance">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {!selected ? (
          <p className="text-sm text-foreground/60">
            No nucleus instance was isolated on this field. Whole-image classification results are still available above.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <img src={`data:image/png;base64,${selected.image}`} alt={`Instance ${selected.id}`} className="h-16 w-16 rounded-lg border border-border object-cover" />
              <div>
                <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${TONE_BADGE[classMeta(selected.predicted_class).tone]}`}>
                  {classMeta(selected.predicted_class).label}
                </span>
                <p className="mt-1 text-sm text-foreground/70">
                  Instance {selected.id} · {toPercent(selected.confidence, 1)} calibrated
                </p>
              </div>
            </div>

            {morphometrics ? (
              <div>
                <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-2">Morphometric measurements</p>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-t border-border">
                      <td className="py-1.5 text-foreground/70">Nucleus area</td>
                      <td className="py-1.5 text-right font-medium text-foreground tabular-nums">{morphometrics.nucleus_area_px} px²</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="py-1.5 text-foreground/70">Cytoplasm area</td>
                      <td className="py-1.5 text-right font-medium text-foreground tabular-nums">{morphometrics.cytoplasm_area_px} px²</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="py-1.5 text-foreground/70">Nucleus / cytoplasm ratio</td>
                      <td className="py-1.5 text-right font-medium text-foreground tabular-nums">{formatNumber(morphometrics.nc_ratio, 3)}</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="py-1.5 text-foreground/70">Nuclear circularity</td>
                      <td className="py-1.5 text-right font-medium text-foreground tabular-nums">{formatNumber(morphometrics.circularity, 2)}</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="py-1.5 text-foreground/70">Solidity</td>
                      <td className="py-1.5 text-right font-medium text-foreground tabular-nums">{formatNumber(morphometrics.solidity, 2)}</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="py-1.5 text-foreground/70">Equivalent diameter</td>
                      <td className="py-1.5 text-right font-medium text-foreground tabular-nums">{morphometrics.equivalent_diameter_px} px</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="py-1.5 text-foreground/70">Chromatin dispersion</td>
                      <td className="py-1.5 text-right font-medium text-foreground tabular-nums">{formatNumber(morphometrics.chromatin_std, 1)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}

            {selected.anomalies?.length ? (
              <div>
                <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-2">Localized observations</p>
                <ul className="space-y-2">
                  {selected.anomalies.map((anomaly) => (
                    <AnomalyRow key={anomaly.label} anomaly={anomaly} />
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-2">Model confidence</p>
              <MeterBar label="Calibrated probability" value={selected.confidence} display={toPercent(selected.confidence, 1)} />
              {typeof selected.uncertainty === 'number' ? (
                <p className="mt-2 text-xs text-foreground/60">
                  Bayesian uncertainty ± {formatNumber(selected.uncertainty * 100, 1)} pts · entropy {formatNumber(selected.entropy, 2)}
                </p>
              ) : null}
            </div>
          </>
        )}

        {stats ? (
          <div className="rounded-lg bg-secondary/40 p-4 space-y-2 text-sm">
            <p className="flex items-center gap-2 text-xs font-semibold text-foreground/60 uppercase tracking-wide">
              <Info size={14} /> Field-level segmentation
            </p>
            <div className="flex justify-between"><span className="text-foreground/70">Mean nucleus area</span><span className="font-medium tabular-nums">{stats.mean_nucleus_area_px} px²</span></div>
            <div className="flex justify-between"><span className="text-foreground/70">Mean circularity</span><span className="font-medium tabular-nums">{formatNumber(stats.mean_circularity, 2)}</span></div>
            <div className="flex justify-between"><span className="text-foreground/70">Mean N/C ratio</span><span className="font-medium tabular-nums">{formatNumber(stats.mean_nc_ratio, 3)}</span></div>
            <div className="flex justify-between"><span className="text-foreground/70">Method</span><span className="font-medium">{stats.source === 'hovernet' ? 'HoVer-Net' : 'Watershed'}</span></div>
          </div>
        ) : null}

        <p className="text-xs text-foreground/60 leading-relaxed">
          Measurements are expressed in image pixels and provided for guidance only; they must be interpreted in the
          clinical context. Cytoplasm boundaries are estimated from a dilation ring around each nucleus.
        </p>
      </div>
    </div>
  );
}
