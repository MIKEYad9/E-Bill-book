import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download,
  X,
  Smartphone,
  Share,
  PlusSquare,
  Sparkles,
  CheckCircle2,
  Tv
} from 'lucide-react';
import { SecureStorage } from '../db';
import logoImg from '../assets/images/ebook_logo_1780230548111.png';

interface PWAInstallPromptProps {
  isLoggedIn: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstallPrompt({ isLoggedIn }: PWAInstallPromptProps) {
  // PWA trigger states
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [eligibleToShow, setEligibleToShow] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [hasPromptedThisSession, setHasPromptedThisSession] = useState(false);

  // Detect iOS Safari or Standalone constraints
  useEffect(() => {
    const isIOSDetect =
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
      !('standalone' in window.navigator && (window.navigator as any).standalone);
    setIsIOS(isIOSDetect);

    // Standard native "beforeinstallprompt" event listener for Android/Windows
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Listen to "appinstalled" for successful prompt outcome
    const handleAppInstalled = () => {
      window.dispatchEvent(
        new CustomEvent('add-session-log', {
          detail: '📱 PWA Analytics: E-Bill Book installed successfully on native device screen'
        })
      );
      setShowSuccessToast(true);
      setShowPrompt(false);
      // Suppress showing it again in this session
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Set Eligibility timer: Display after 5 seconds of active page mount
  useEffect(() => {
    if (!isLoggedIn) return;

    const timer = setTimeout(() => {
      setEligibleToShow(true);
    }, 5000);

    // Or listen to custom POS First Bill Generation trigger Event
    const handleFirstBillGenerated = () => {
      setEligibleToShow(true);
    };

    window.addEventListener('bill-generated', handleFirstBillGenerated);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('bill-generated', handleFirstBillGenerated);
    };
  }, [isLoggedIn]);

  // Determine whether we satisfy all rules to show the popup
  useEffect(() => {
    if (!isLoggedIn || !eligibleToShow || hasPromptedThisSession) {
      setShowPrompt(false);
      return;
    }

    // Checking Standalone View state
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && (window.navigator as any).standalone);

    if (isStandalone) {
      setShowPrompt(false);
      return;
    }

    // Checking Dismissal 7 Days Cool-off state
    const dismissedAt = SecureStorage.getItem('ai_billing_pwa_dismissed_at');
    if (dismissedAt) {
      const parsedTime = parseInt(dismissedAt, 10);
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - parsedTime < sevenDaysMs) {
        setShowPrompt(false);
        return;
      }
    }

    // For non-iOS platforms, only display if the deferred install event trigger is captured
    if (!isIOS && !deferredPrompt) {
      setShowPrompt(false);
      return;
    }

    // Show the modal
    setShowPrompt(true);
    setHasPromptedThisSession(true);

    // Log viewed analytics trigger
    window.dispatchEvent(
      new CustomEvent('add-session-log', {
        detail: `💡 PWA Analytics: Install Prompt Banner triggered & viewed [Platform: ${isIOS ? 'iOS Safari' : 'Android/Desktop Native'}]`
      })
    );
  }, [isLoggedIn, eligibleToShow, deferredPrompt, isIOS, hasPromptedThisSession]);

  // Handle Dismissal (Not Now button)
  const handleNotNow = () => {
    // Record current epoch to apply 7-day storage suppression
    SecureStorage.setItem('ai_billing_pwa_dismissed_at', Date.now().toString());
    setShowPrompt(false);

    window.dispatchEvent(
      new CustomEvent('add-session-log', {
        detail: '⚠️ PWA Analytics: User dismissed application install banner (Supressed for 7 days)'
      })
    );
  };

  // Trigger PWA installation manually
  const handleInstallClick = async () => {
    if (isIOS) {
      // Just keep showing guide inside the frame
      return;
    }

    if (!deferredPrompt) return;

    window.dispatchEvent(
      new CustomEvent('add-session-log', {
        detail: '⚡ PWA Analytics: Triggered native browser applet installation dialog'
      })
    );

    await deferredPrompt.prompt();

    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        window.dispatchEvent(
          new CustomEvent('add-session-log', {
            detail: '✅ PWA Analytics: User successfully accepted native install request'
          })
        );
      } else {
        window.dispatchEvent(
          new CustomEvent('add-session-log', {
            detail: '❌ PWA Analytics: User rejected browser app install prompt'
          })
        );
      }
      setDeferredPrompt(null);
      setShowPrompt(false);
    });
  };

  return (
    <>
      <AnimatePresence>
        {showPrompt && (
          <div className="fixed bottom-4 left-4 right-4 md:bottom-6 md:right-6 md:left-auto md:w-[420px] z-50 pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-5 shadow-2xl backdrop-blur-xl font-sans"
              role="alert"
              aria-live="polite"
            >
              {/* Header */}
              <div className="flex items-start gap-3.5 mb-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 via-pink-500 to-rose-500 p-[1.5px] shadow-lg flex-shrink-0 flex items-center justify-center">
                  <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center overflow-hidden">
                    <img
                      src={logoImg}
                      alt="E-Bill Book branding insignia"
                      className="w-8 h-8 object-contain"
                    />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-black text-white tracking-tight">
                      Install E-Bill Book
                    </h3>
                    <span className="bg-rose-500/10 text-rose-450 border border-rose-500/20 text-[8px] font-mono tracking-wider px-1.5 py-0.5 rounded uppercase font-black flex items-center gap-0.5">
                      <Sparkles className="w-2 h-2 text-amber-400 fill-amber-400 animate-pulse" />
                      Standalone App
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold font-mono uppercase tracking-wider block mt-0.5">
                    Fast • Secure • Offline Friendly
                  </span>
                </div>

                <button
                  onClick={handleNotNow}
                  className="p-1 rounded-lg text-slate-405 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                  aria-label="Dismiss installation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tagline */}
              <p className="text-xs text-slate-300 leading-relaxed font-normal mb-4">
                Install E-Bill Book on your device for lightning fast invoice calculation, secure offline ledger access, and a better responsive touch experience.
              </p>

              {/* iOS Safari Install Guide Manual Panel */}
              {isIOS ? (
                <div className="bg-slate-950/60 rounded-2xl border border-slate-800/60 p-3.5 space-y-2.5">
                  <span className="text-[9px] font-black tracking-widest text-[#fbbf24] uppercase block font-mono">
                    📲 Apple iOS Safari Installation Guide:
                  </span>
                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center justify-center shrink-0">
                        <Share className="w-3.5 h-3.5 text-sky-400" />
                      </div>
                      <p className="text-[11px] leading-snug">
                        1. Tap the <strong className="text-white">Share</strong> button in Safari's lower navigation tray.
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center justify-center shrink-0">
                        <PlusSquare className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <p className="text-[11px] leading-snug">
                        2. Scroll down and press <strong className="text-white">"Add to Home Screen"</strong>.
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 font-sans leading-none text-slate-400 text-[10px] pl-[34px]">
                      <span>3. Check top-right of screen for completion.</span>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-900 mt-2.5">
                    <span className="text-[9px] text-slate-500 font-mono font-medium">Installed already?</span>
                    <button
                      onClick={() => {
                        setShowPrompt(false);
                        window.dispatchEvent(
                          new CustomEvent('add-session-log', {
                            detail: '✅ PWA Analytics: iOS user marked prompt as installed'
                          })
                        );
                      }}
                      className="text-[10px] text-rose-450 hover:text-rose-400 font-extrabold cursor-pointer border-b border-rose-500/25 pb-0.5 transition-colors"
                    >
                      Hide instruction
                    </button>
                  </div>
                </div>
              ) : (
                /* Native OS Promo Buttons (Android/Windows) */
                <div className="grid grid-cols-2 gap-2.5 mt-2">
                  <button
                    onClick={handleNotNow}
                    className="bg-slate-800 hover:bg-slate-700/80 text-slate-205 py-2.5 px-4 text-xs font-bold rounded-2xl border border-slate-700/60 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    Not Now
                  </button>
                  <button
                    onClick={handleInstallClick}
                    className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white py-2.5 px-4 text-xs font-black rounded-2xl shadow-lg ring-1 ring-rose-500/30 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 text-center leading-none"
                  >
                    <Download className="w-3.5 h-3.5 animate-bounce" />
                    <span>Install App</span>
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Notification Alert Toast */}
      <AnimatePresence>
        {showSuccessToast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, y: -40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="bg-emerald-950/90 border border-emerald-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex items-center gap-3"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 animate-pulse" />
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 block font-mono">
                  ✨ SUCCESSFUL INSTALLATION
                </span>
                <p className="text-xs text-emerald-100 font-bold leading-snug">
                  E-Bill Book successfully installed!
                </p>
                <p className="text-[10px] text-emerald-305 leading-relaxed font-sans">
                  Launch from your app list for native premium access.
                </p>
              </div>
              <button
                onClick={() => setShowSuccessToast(false)}
                className="text-emerald-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
