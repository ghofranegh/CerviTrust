export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-secondary border-t border-border mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">CerviTrust</h3>
            <p className="text-sm text-foreground/70">
              Clinical decision support for cervical cytology screening.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">Navigation</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/" className="text-foreground/70 hover:text-foreground transition-colors">
                  Home
                </a>
              </li>
              <li>
                <a href="/analysis" className="text-foreground/70 hover:text-foreground transition-colors">
                  Analysis
                </a>
              </li>
              <li>
                <a href="/dashboard" className="text-foreground/70 hover:text-foreground transition-colors">
                  Dashboard
                </a>
              </li>
              <li>
                <a href="/saved-reports" className="text-foreground/70 hover:text-foreground transition-colors">
                  Saved Reports
                </a>
              </li>
              <li>
                <a href="/system" className="text-foreground/70 hover:text-foreground transition-colors">
                  System Overview
                </a>
              </li>
              <li>
                <a href="/about" className="text-foreground/70 hover:text-foreground transition-colors">
                  About
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">Legal</h3>
            <p className="text-xs text-foreground/70">
              This software is intended as a clinical decision support tool and is not a replacement for professional medical diagnosis.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border pt-8">
          <p className="text-xs text-foreground/60 text-center">
            © {currentYear} CerviTrust. All rights reserved. For research and clinical decision support use only.
          </p>
        </div>
      </div>
    </footer>
  );
}
