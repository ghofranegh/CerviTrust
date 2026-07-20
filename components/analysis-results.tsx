import { StatusBadge } from '@/components/status-badge';
import { AlertCircle } from 'lucide-react';

interface AnalysisResultsProps {
  analysis: {
    assessment: 'nilm' | 'lsil' | 'hsil';
    confidence: number;
    findings: string;
    recommendation: string;
  };
}

export function AnalysisResults({ analysis }: AnalysisResultsProps) {
  const getSeverityIcon = (assessment: string) => {
    switch (assessment) {
      case 'nilm':
        return '✓';
      case 'lsil':
        return '!';
      case 'hsil':
        return '⚠';
      default:
        return '';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-border p-6 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Quick Results</h3>

      {/* Assessment */}
      <div>
        <p className="text-xs text-foreground/60 mb-2">Assessment</p>
        <StatusBadge status={analysis.assessment} className="w-full justify-center" />
      </div>

      {/* Confidence */}
      <div>
        <p className="text-xs text-foreground/60 mb-2">Confidence Level</p>
        <div className="text-2xl font-bold text-primary">{analysis.confidence}%</div>
        <div className="w-full h-1 bg-foreground/10 rounded-full overflow-hidden mt-2">
          <div className="h-full bg-primary rounded-full" style={{ width: `${analysis.confidence}%` }} />
        </div>
      </div>

      {/* Status Indicator */}
      <div className="bg-secondary rounded p-3 flex gap-2 items-start">
        <AlertCircle size={16} className="text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/70">Review recommended before final diagnosis</p>
      </div>
    </div>
  );
}
