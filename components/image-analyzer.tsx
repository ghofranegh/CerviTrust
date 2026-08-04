'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Upload, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { MedicalCard } from '@/components/medical-card';
import { AnalysisResults } from '@/components/analysis-results';
import { getStoredDoctorToken } from '@/lib/client-auth';

type AnalysisStatus = 'idle' | 'analyzing' | 'complete';
type ScreeningResult = 'nilm' | 'lsil' | 'hsil';

interface GradcamData {
  heatmap: string;
  overlay: string;
  attention_overlay?: string;
}

interface SegmentationData {
  overlay: string;
  background: string;
  cytoplasm: string;
  nucleus: string;
}

interface RegionOfInterest {
  id: number;
  predicted_class: string;
  confidence: number;
  image: string;
}

interface Analysis {
  assessment: ScreeningResult;
  confidence: number;
  findings: string;
  recommendation: string;
  probabilities?: Record<string, number>;
  regions_of_interest?: RegionOfInterest[];
  gradcam?: GradcamData;
  segmentation?: SegmentationData;
}

interface DoctorProfile {
  id: string;
  fullName: string;
  email: string;
  hospital: string;
  specialty: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export function ImageAnalyzer({ doctor, onSaved }: { doctor?: DoctorProfile | null; onSaved?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(doctor ?? null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [patientInfo, setPatientInfo] = useState({ patientName: '', patientId: '', dateOfBirth: '', notes: '' });
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadingMessages = [
    'Analyzing image',
    'Detecting nuclei',
    'Generating heatmaps',
    'Preparing report',
  ];

  const normalizeAssessment = (value: string): ScreeningResult => {
    const normalized = value.toLowerCase();
    if (normalized === 'scc') return 'hsil';
    return normalized as ScreeningResult;
  };

  useEffect(() => {
    if (status !== 'analyzing') return;

    const interval = window.setInterval(() => {
      setLoadingMessageIndex((current) => (current + 1) % loadingMessages.length);
    }, 900);

    return () => window.clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (doctor) {
      setDoctorProfile(doctor);
      return;
    }

    const token = getStoredDoctorToken();
    if (!token) {
      setDoctorProfile(null);
      return;
    }

    void fetch('/api/auth/me', {
      headers: { 'x-doctor-token': token },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.doctor) {
          setDoctorProfile(data.doctor);
        } else {
          setDoctorProfile(null);
        }
      })
      .catch(() => {
        setDoctorProfile(null);
      });
  }, [doctor]);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
    setStatus('idle');
    setAnalysis(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setStatus('analyzing');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await res.json();

      const assessment = normalizeAssessment(data.predicted_class ?? 'nilm');
      const roiList = Array.isArray(data.regions_of_interest) ? data.regions_of_interest : [];

      const results: Analysis = {
        assessment,
        confidence: Math.round((data.confidence ?? 0) * 100),
        findings: `Predicted class: ${data.predicted_class ?? 'unknown'}. ${roiList.length} region(s) of interest identified.`,
        recommendation:
          (data.confidence ?? 0) < 0.5
            ? 'Low confidence — expert review strongly recommended.'
            : 'Expert review is recommended before establishing a final diagnosis.',
        probabilities: data.probabilities ?? undefined,
        regions_of_interest: roiList.map((roi: RegionOfInterest) => ({
          ...roi,
          predicted_class: roi.predicted_class,
        })),
        gradcam: data.gradcam
          ? {
              heatmap: data.gradcam.heatmap,
              overlay: data.gradcam.overlay,
              attention_overlay: data.gradcam.attention_overlay,
            }
          : undefined,
        segmentation: data.segmentation
          ? {
              overlay: data.segmentation.overlay,
              background: data.segmentation.background,
              cytoplasm: data.segmentation.cytoplasm,
              nucleus: data.segmentation.nucleus,
            }
          : undefined,
      };

      setAnalysis(results);
      setStatus('complete');
    } catch (err) {
      console.error(err);
      setStatus('idle');
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    setStatus('idle');
    setAnalysis(null);
    setPatientInfo({ patientName: '', patientId: '', dateOfBirth: '', notes: '' });
    setSaveMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveAnalysis = async () => {
    if (!analysis || !doctorProfile) return;

    setSaveLoading(true);
    setSaveMessage('');

    try {
      const token = getStoredDoctorToken();
      const res = await fetch('/api/analyses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-doctor-token': token ?? '',
        },
        body: JSON.stringify({
          patientName: patientInfo.patientName,
          patientId: patientInfo.patientId,
          dateOfBirth: patientInfo.dateOfBirth,
          notes: patientInfo.notes,
          assessment: analysis.assessment,
          confidence: analysis.confidence,
          findings: analysis.findings,
          recommendation: analysis.recommendation,
          analysisData: analysis,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to save report');
      setSaveMessage('Report saved successfully.');
      setPatientInfo((current) => ({ ...current, notes: '' }));
      onSaved?.();
    } catch (err) {
      console.error(err);
      setSaveMessage(err instanceof Error ? err.message : 'Unable to save report');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDownloadImage = (base64Image: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64Image}`;
    link.download = filename;
    link.click();
  };

  const segmentation = analysis?.segmentation;
  const hasSegmentation = Boolean(segmentation && Object.values(segmentation).some(Boolean));

  return (
    <div className="space-y-8">
      {/* Upload Area */}
      {!preview ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 hover:bg-secondary/50 transition-all cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={48} className="mx-auto mb-4 text-foreground/40" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Upload Cervical Cytology Image</h3>
          <p className="text-foreground/60 mb-4">
            Drag and drop your image here, or click to select
          </p>
          <p className="text-xs text-foreground/50 mb-6">
            Supported formats: PNG, JPG, TIFF
          </p>
          <Button size="sm" variant="outline" className="border-foreground/20">
            Choose File
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            className="hidden"
          />
        </div>
      ) : (
        /* Image Display & Analysis */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Image Preview */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg border border-border overflow-hidden">
                <div className="relative w-full bg-foreground/5">
                  {preview && (
                    <Image
                      src={preview}
                      alt="Uploaded cytology image"
                      width={600}
                      height={600}
                      className="w-full h-auto object-cover max-h-96"
                    />
                  )}
                </div>

                {/* Image Controls */}
                {!analysis && (
                  <div className="p-6 bg-white border-t border-border flex gap-3">
                    <Button onClick={handleAnalyze} disabled={status === 'analyzing'} size="lg" className="flex-1 bg-primary hover:bg-primary/90 text-white">
                      {status === 'analyzing' ? (
                        <>
                          <span className="inline-block mr-2 animate-pulse">⏳</span>
                          {loadingMessages[loadingMessageIndex]}
                          <span className="ml-2 inline-block animate-bounce">…</span>
                        </>
                      ) : (
                        'Start Analysis'
                      )}
                    </Button>
                    <Button onClick={handleClear} variant="outline" size="lg" className="border-foreground/20">
                      <X size={20} />
                    </Button>
                  </div>
                )}

                {/* Analysis Complete Actions */}
                {analysis && (
                  <div className="p-6 bg-white border-t border-border flex gap-3">
                    <Button onClick={handleClear} variant="outline" size="lg" className="flex-1 border-foreground/20">
                      New Analysis
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Info Panel */}
            <div className="space-y-4">
              {!analysis ? (
                <div className="bg-secondary rounded-lg p-6 border border-border">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Image Details</h3>
                  <div className="space-y-2 text-xs text-foreground/60">
                    <p>File: {file?.name}</p>
                    <p>Size: {(file?.size ? file.size / 1024 / 1024 : 0).toFixed(2)} MB</p>
                    <p>Ready for analysis</p>
                  </div>
                </div>
              ) : (
                <AnalysisResults analysis={analysis} />
              )}
            </div>
          </div>

          {/* Full Results */}
          {analysis && (
            <div className="bg-white rounded-lg border border-border p-8 space-y-8">
              <div className="border-b border-border pb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-6">Screening Assessment Results</h2>

                {/* Assessment Card */}
                <div className="space-y-4 mb-8">
                  <div>
                    <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-3">
                      Cytological Classification
                    </p>
                    <StatusBadge status={analysis.assessment} />
                  </div>
                </div>

                {/* Confidence Metric */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Clinical Confidence</p>
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold text-primary">{analysis.confidence}%</div>
                    <div className="flex-1 h-2 bg-foreground/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${analysis.confidence}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Clinical Findings */}
              <div className="space-y-4 border-b border-border pb-8">
                <h3 className="text-lg font-semibold text-foreground">Findings Summary</h3>
                <p className="text-base text-foreground/70 leading-relaxed">{analysis.findings}</p>
              </div>

              {analysis.probabilities && (
                <div className="space-y-4 border-b border-border pb-8">
                  <h3 className="text-lg font-semibold text-foreground">Class Probabilities</h3>
                  <div className="space-y-3">
                    {Object.entries(analysis.probabilities).map(([label, value]) => (
                      <div key={label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground/70">{label}</span>
                          <span className="font-semibold text-foreground">{Math.round(value * 100)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-foreground/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.max(4, Math.round(value * 100))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.regions_of_interest && analysis.regions_of_interest.length > 0 && (
                <div className="space-y-4 border-b border-border pb-8">
                  <h3 className="text-lg font-semibold text-foreground">Regions of Interest</h3>
                  <p className="text-sm text-foreground/60">
                    High-attention nuclei identified during the analysis.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {analysis.regions_of_interest.map((roi) => (
                      <div key={roi.id} className="rounded-lg border border-border bg-secondary/20 p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">ROI #{roi.id}</p>
                          <span className="text-xs rounded-full bg-white px-2 py-1 text-foreground/70">
                            {roi.predicted_class}
                          </span>
                        </div>
                        <img
                          src={`data:image/png;base64,${roi.image}`}
                          alt={`Region of interest ${roi.id}`}
                          className="w-full h-40 object-contain rounded-md bg-white"
                        />
                        <div className="flex items-center justify-between text-sm text-foreground/70">
                          <span>Prediction confidence</span>
                          <span className="font-semibold text-foreground">{Math.round(roi.confidence * 100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Visualizations */}
              {(analysis.gradcam || analysis.segmentation) && (
                <div className="space-y-6 border-b border-border pb-8">
                  <h3 className="text-lg font-semibold text-foreground">Visualizations</h3>

                  {analysis.gradcam && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="rounded-lg border border-border p-4 bg-secondary/30">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-medium text-foreground">Activation Heatmap</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-foreground/20"
                            onClick={() => handleDownloadImage(analysis.gradcam!.heatmap, 'gradcam-heatmap.png')}
                          >
                            Download
                          </Button>
                        </div>
                        <img
                          src={`data:image/png;base64,${analysis.gradcam.heatmap}`}
                          alt="Grad-CAM heatmap"
                          className="w-full h-64 object-contain rounded-md bg-white"
                        />
                      </div>
                      <div className="rounded-lg border border-border p-4 bg-secondary/30">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-medium text-foreground">Grad-CAM Overlay</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-foreground/20"
                            onClick={() => handleDownloadImage(analysis.gradcam!.overlay, 'gradcam-overlay.png')}
                          >
                            Download
                          </Button>
                        </div>
                        <img
                          src={`data:image/png;base64,${analysis.gradcam.overlay}`}
                          alt="Grad-CAM overlay"
                          className="w-full h-64 object-contain rounded-md bg-white"
                        />
                      </div>
                    </div>
                  )}

                  {analysis.gradcam?.attention_overlay && (
                    <div className="rounded-lg border border-border p-4 bg-secondary/30">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-foreground">Attention Overlay</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-foreground/20"
                          onClick={() => handleDownloadImage(analysis.gradcam!.attention_overlay!, 'attention-overlay.png')}
                        >
                          Download
                        </Button>
                      </div>
                      <img
                        src={`data:image/png;base64,${analysis.gradcam.attention_overlay}`}
                        alt="Attention overlay"
                        className="w-full h-64 object-contain rounded-md bg-white"
                      />
                    </div>
                  )}

                </div>
              )}

              <div className="space-y-4 border-b border-border pb-8">
                <h3 className="text-lg font-semibold text-foreground">Save Report for Patient</h3>
                {!doctorProfile ? (
                  <p className="text-sm text-foreground/60">Sign in to attach patient details and save this analysis to your account.</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      className="rounded-lg border border-border px-3 py-2"
                      placeholder="Patient name"
                      value={patientInfo.patientName}
                      onChange={(event) => setPatientInfo({ ...patientInfo, patientName: event.target.value })}
                    />
                    <input
                      className="rounded-lg border border-border px-3 py-2"
                      placeholder="Patient ID"
                      value={patientInfo.patientId}
                      onChange={(event) => setPatientInfo({ ...patientInfo, patientId: event.target.value })}
                    />
                    <input
                      className="rounded-lg border border-border px-3 py-2"
                      placeholder="Date of birth"
                      value={patientInfo.dateOfBirth}
                      onChange={(event) => setPatientInfo({ ...patientInfo, dateOfBirth: event.target.value })}
                    />
                    <textarea
                      className="md:col-span-2 min-h-24 rounded-lg border border-border px-3 py-2"
                      placeholder="Clinical notes"
                      value={patientInfo.notes}
                      onChange={(event) => setPatientInfo({ ...patientInfo, notes: event.target.value })}
                    />
                    <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                      <Button onClick={handleSaveAnalysis} disabled={saveLoading || !doctorProfile}>
                        {saveLoading ? 'Saving…' : 'Save report'}
                      </Button>
                      {saveMessage ? <span className="text-sm text-foreground/70">{saveMessage}</span> : null}
                    </div>
                  </div>
                )}
              </div>

              {/* Recommendation */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Clinical Recommendation</h3>
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-6">
                  <p className="text-base text-foreground leading-relaxed">{analysis.recommendation}</p>
                </div>
              </div>

              {/* Medical Disclaimer */}
              <div className="bg-secondary border border-border rounded-lg p-6 text-center">
                <p className="text-xs text-foreground/60">
                  <strong className="text-foreground">Disclaimer:</strong> This assessment is provided as clinical decision support. Final diagnostic decisions must be made by qualified pathology professionals in accordance with clinical standards and protocols.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}