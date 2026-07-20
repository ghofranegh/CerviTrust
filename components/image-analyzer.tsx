'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Upload, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { MedicalCard } from '@/components/medical-card';
import { AnalysisResults } from '@/components/analysis-results';

type AnalysisStatus = 'idle' | 'analyzing' | 'complete';
type ScreeningResult = 'nilm' | 'lsil' | 'hsil';

interface Analysis {
  assessment: ScreeningResult;
  confidence: number;
  findings: string;
  recommendation: string;
}

export function ImageAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      const rawClass = data.predicted_class.toLowerCase();
      const assessment: ScreeningResult = rawClass === 'scc' ? 'hsil' : (rawClass as ScreeningResult);

      const results: Analysis = {
        assessment,
        confidence: Math.round(data.confidence * 100),
        findings: `Predicted class: ${data.predicted_class}. ${data.regions_of_interest.length} region(s) of interest identified.`,
        recommendation:
          data.confidence < 0.5
            ? 'Low confidence — expert review strongly recommended.'
            : 'Expert review is recommended before establishing a final diagnosis.',
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
                          <span className="animate-spin inline-block mr-2">⏳</span>
                          Analyzing...
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