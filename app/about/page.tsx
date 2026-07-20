import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { Target, Eye, Shield } from 'lucide-react';

export default function AboutPage() {
  return (
    <main className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <section className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <div className="mb-12">
          <h1 className="text-4xl font-semibold text-foreground mb-4">About CerviTrust</h1>
          <p className="text-lg text-foreground/60">
            Clinical decision support for cervical cytology screening
          </p>
        </div>

        {/* Project Overview */}
        <div className="bg-white rounded-lg border border-border p-8 mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Project Overview</h2>
          <p className="text-foreground/70 leading-relaxed mb-4">
            CerviTrust is a research-oriented clinical decision support platform designed to assist healthcare professionals in cervical cytology screening. By analyzing microscopic cervical cell images, the system helps identify potentially abnormal cellular patterns, highlights relevant image regions, and provides structured screening support.
          </p>
          <p className="text-foreground/70 leading-relaxed">
            The platform is intended to improve workflow efficiency and assist specialists in prioritizing cases requiring detailed examination. Final diagnosis always remains the responsibility of qualified medical professionals.
          </p>
        </div>

        {/* Mission & Vision */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Mission */}
          <div className="bg-white rounded-lg border border-border p-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary flex-shrink-0">
                <Target size={24} />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground">Mission</h3>
              </div>
            </div>
            <p className="text-foreground/70 leading-relaxed">
              To provide healthcare professionals with intelligent, reliable clinical decision support tools that enhance cervical cytology screening efficiency while maintaining the highest standards of medical professionalism and patient care.
            </p>
          </div>

          {/* Vision */}
          <div className="bg-white rounded-lg border border-border p-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary flex-shrink-0">
                <Eye size={24} />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground">Vision</h3>
              </div>
            </div>
            <p className="text-foreground/70 leading-relaxed">
              To enable pathology laboratories worldwide to deliver more efficient and consistent cervical cytology screening while supporting early detection of abnormalities and improving clinical outcomes.
            </p>
          </div>
        </div>

        {/* Core Principles */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Core Principles</h2>
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-border p-6 flex items-start gap-4">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">Clinical Reliability</h3>
                <p className="text-sm text-foreground/70">
                  All recommendations are grounded in clinical evidence and designed to support, not replace, professional medical judgment.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-6 flex items-start gap-4">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">Professional Respect</h3>
                <p className="text-sm text-foreground/70">
                  The system is designed as a tool for qualified healthcare professionals, with full transparency about capabilities and limitations.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-6 flex items-start gap-4">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">Simplicity & Clarity</h3>
                <p className="text-sm text-foreground/70">
                  Medical concepts are presented clearly and professionally, without unnecessary technical jargon or AI hype.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-6 flex items-start gap-4">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">Continuous Improvement</h3>
                <p className="text-sm text-foreground/70">
                  The system benefits from ongoing research, clinical feedback, and refinement to serve healthcare professionals better.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Disclaimer */}
        <div className="bg-secondary rounded-lg border border-border p-8 mb-12">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary flex-shrink-0 flex-shrink-0">
              <Shield size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">Clinical Disclaimer</h2>
              <p className="text-foreground/70 leading-relaxed mb-3">
                <strong>CerviTrust is intended as a clinical decision support tool and is NOT a replacement for professional medical diagnosis.</strong>
              </p>
              <ul className="space-y-2 text-sm text-foreground/70">
                <li className="flex gap-2">
                  <span>•</span>
                  <span>All final diagnostic decisions must be made by qualified medical professionals.</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>The system should be used within institutional clinical settings and protocols.</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Healthcare professionals retain full responsibility for patient care and diagnostic interpretation.</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Use of this platform must comply with applicable medical regulations and institutional policies.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Research Use */}
        <div className="bg-white rounded-lg border border-border p-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Research & Development</h2>
          <p className="text-foreground/70 leading-relaxed mb-4">
            CerviTrust was developed as a research platform to advance understanding of digital pathology and clinical decision support. The platform continues to evolve through collaboration with clinical partners and ongoing research initiatives.
          </p>
          <p className="text-foreground/70 leading-relaxed">
            We welcome feedback from healthcare professionals and researchers interested in advancing cervical cytology screening through technology. Inquiries regarding research partnerships or clinical collaboration are encouraged.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
