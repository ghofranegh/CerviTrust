import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { MedicalCard } from '@/components/medical-card';
import { Clock, Image, BookOpen, Package } from 'lucide-react';

export default function SystemPage() {
  return (
    <main className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <section className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="mb-12">
          <h1 className="text-4xl font-semibold text-foreground mb-2">System Overview</h1>
          <p className="text-foreground/60">
            Understanding CerviTrust capabilities and clinical workflow support
          </p>
        </div>

        {/* System Capabilities */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-8">System Capabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MedicalCard
              label="Response Time"
              value={<span className="text-primary">2-5 sec</span>}
              subtitle="Average analysis duration"
            />
            <MedicalCard
              label="Image Types"
              value={<span className="text-primary">Multiple</span>}
              subtitle="Supported formats: PNG, JPG, TIFF"
            />
            <MedicalCard
              label="Classifications"
              value={<span className="text-primary">3+</span>}
              subtitle="Bethesda system categories"
            />
            <MedicalCard
              label="Platform"
              value={<span className="text-primary">Web-based</span>}
              subtitle="Secure clinical environment"
            />
          </div>
        </div>

        {/* Supported Categories */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-8">Screening Categories</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-border p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-status-success/10 rounded-lg flex items-center justify-center text-status-success flex-shrink-0">
                  <span className="text-xl">✓</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">NILM</h3>
                  <p className="text-sm text-foreground/70">
                    Negative for Intraepithelial Lesion. No significant abnormalities detected.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-status-warning/10 rounded-lg flex items-center justify-center text-status-warning flex-shrink-0">
                  <span className="text-xl">!</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">LSIL</h3>
                  <p className="text-sm text-foreground/70">
                    Low-Grade Squamous Intraepithelial Lesion. Mild cellular abnormalities identified.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-status-critical/10 rounded-lg flex items-center justify-center text-status-critical flex-shrink-0">
                  <span className="text-xl">⚠</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">HSIL</h3>
                  <p className="text-sm text-foreground/70">
                    High-Grade Squamous Intraepithelial Lesion. Significant abnormalities detected.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center text-muted-foreground flex-shrink-0">
                  <span className="text-xl">?</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Other</h3>
                  <p className="text-sm text-foreground/70">
                    Additional categories including ASC, AGUS, or other findings.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Workflow */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-8">Clinical Workflow Integration</h2>
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-border p-6 flex items-start gap-4">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold flex-shrink-0 text-sm">
                1
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Image Upload</h3>
                <p className="text-sm text-foreground/70">
                  Healthcare professionals upload cervical cytology images through the secure web interface.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-6 flex items-start gap-4">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold flex-shrink-0 text-sm">
                2
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Automated Analysis</h3>
                <p className="text-sm text-foreground/70">
                  The system performs rapid analysis and generates screening recommendations with confidence metrics.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-6 flex items-start gap-4">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold flex-shrink-0 text-sm">
                3
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Visual Highlighting</h3>
                <p className="text-sm text-foreground/70">
                  Relevant cellular regions are highlighted to support pathologist review and interpretation.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-6 flex items-start gap-4">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold flex-shrink-0 text-sm">
                4
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Professional Review</h3>
                <p className="text-sm text-foreground/70">
                  Qualified medical professionals make final diagnostic decisions using the system&apos;s support.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Information */}
        <div className="bg-secondary rounded-lg border border-border p-8">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Technical Information</h2>
          <p className="text-foreground/70 mb-6 leading-relaxed">
            CerviTrust has been developed for research and clinical decision support purposes. The platform integrates contemporary image analysis techniques to assist healthcare professionals in cervical cytology screening workflows. The system is designed to improve workflow efficiency and assist specialists in prioritizing cases requiring detailed examination.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-border">
            <div>
              <h3 className="font-semibold text-foreground mb-2">Research-Oriented</h3>
              <p className="text-sm text-foreground/70">
                Developed to support clinical research and decision support in cervical cytology screening.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Professional Use</h3>
              <p className="text-sm text-foreground/70">
                Designed for healthcare professionals within institutional clinical settings.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
