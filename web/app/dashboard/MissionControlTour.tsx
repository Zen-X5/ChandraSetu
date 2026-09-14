'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { HelpCircle, ChevronRight, ChevronLeft, X, AlertCircle, Compass, CheckCircle2 } from 'lucide-react';

export interface TourStep {
  targetSelector: string;
  title: string;
  description: string;
  badge?: string;
  arrowPosition?: 'left' | 'top' | 'bottom' | 'right';
  videoUrl?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    targetSelector: '[data-tour="nav-home"]',
    title: 'Mission Control Home',
    description: 'Overview of processed Chandrayaan-2 observations, sub-pixel RMSE metrics, and live pipeline execution logs.',
    badge: 'Step 1 of 6',
    arrowPosition: 'left',
  },
  {
    targetSelector: '[data-tour="nav-observations"]',
    title: 'Observations & Lunar GIS Canvas',
    description: 'View registered Chandrayaan-2 image tiles stamped onto an interactive 2D & 3D WebGL selenographic lunar map.',
    badge: 'Step 2 of 6',
    arrowPosition: 'left',
    videoUrl: '/videos/observations_demo.mp4',
  },
  {
    targetSelector: '[data-tour="nav-pipeline"]',
    title: 'Multi-Modal Registration Pipeline',
    description: 'Upload OHRC, TMC-2, or IIRS PDS4 images to execute automated coarse alignment, FFT matching, NMI, and RANSAC validation.',
    badge: 'Step 3 of 6',
    arrowPosition: 'left',
  },
  {
    targetSelector: '[data-tour="nav-staff"]',
    title: 'Staff & Scientist Management',
    description: 'Manage planetary scientist clearance levels, operator profiles, and role-based access control (RBAC).',
    badge: 'Step 4 of 6',
    arrowPosition: 'left',
  },
  {
    targetSelector: '[data-tour="nav-settings"]',
    title: 'SPICE & Pipeline Settings',
    description: 'Configure PDS4 XML metadata parsers, ISRO SPICE kernel paths, spatial RANSAC thresholds, and MinIO S3 object storage.',
    badge: 'Step 5 of 6',
    arrowPosition: 'left',
  },
  {
    targetSelector: '[data-tour="header-payloads"]',
    title: 'Payload Telemetry Status',
    description: 'Live mission network status showing operational readiness for OHRC (Optical), TMC-2 (Stereo), and IIRS (Hyperspectral).',
    badge: 'Step 6 of 6',
    arrowPosition: 'top',
  },
];

interface MissionControlTourProps {
  autoStartOnMount?: boolean;
}

export default function MissionControlTour({ autoStartOnMount = true }: MissionControlTourProps) {
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const startTour = useCallback(() => {
    setActiveStep(0);
  }, []);

  const closeTour = useCallback(() => {
    setActiveStep(null);
  }, []);

  useEffect(() => {
    if (autoStartOnMount && typeof window !== 'undefined') {
      // Small delay to ensure DOM and sidebar elements are fully rendered on login
      const timer = setTimeout(() => {
        setActiveStep(0);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [autoStartOnMount]);

  const updateHighlight = useCallback(() => {
    if (activeStep === null) {
      setTargetRect(null);
      return;
    }

    const step = TOUR_STEPS[activeStep];
    const el = document.querySelector(step.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);

      const isMobile = window.innerWidth < 768;
      const arrow = step.arrowPosition || 'left';

      let top = 0;
      let left = 0;

      if (isMobile) {
        top = rect.bottom + 12;
        left = Math.max(16, Math.min(window.innerWidth - 320, rect.left));
      } else if (arrow === 'left') {
        top = rect.top - 4;
        left = rect.right + 16;
      } else if (arrow === 'top') {
        top = rect.bottom + 16;
        left = Math.max(20, rect.left + rect.width / 2 - 160);
      } else if (arrow === 'bottom') {
        top = rect.top - 180;
        left = Math.max(20, rect.left + rect.width / 2 - 160);
      } else {
        top = rect.top;
        left = rect.left - 340;
      }

      top = Math.max(20, Math.min(window.innerHeight - 240, top));
      left = Math.max(20, Math.min(window.innerWidth - 340, left));

      setTooltipPos({ top, left });
    } else {
      setTargetRect(null);
    }
  }, [activeStep]);

  useEffect(() => {
    updateHighlight();
    window.addEventListener('resize', updateHighlight);
    window.addEventListener('scroll', updateHighlight);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeStep === null) return;
      if (e.key === 'Escape') closeTour();
      if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', updateHighlight);
      window.removeEventListener('scroll', updateHighlight);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeStep, updateHighlight, closeTour]);

  const handleNext = () => {
    if (activeStep === null) return;
    if (activeStep < TOUR_STEPS.length - 1) {
      setActiveStep((prev) => (prev !== null ? prev + 1 : 0));
    } else {
      closeTour();
    }
  };

  const handlePrev = () => {
    if (activeStep === null) return;
    if (activeStep > 0) {
      setActiveStep((prev) => (prev !== null ? prev - 1 : 0));
    }
  };

  const currentStep = activeStep !== null ? TOUR_STEPS[activeStep] : null;

  return (
    <>
      {/* Re-triggerable Guided Tour Button in Header */}
      <button
        type="button"
        onClick={startTour}
        className="px-2.5 py-1 rounded-md bg-[#161A22] hover:bg-[#232833] border border-[#5B8DEF]/40 hover:border-[#5B8DEF] text-[#5B8DEF] font-mono text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
        title="Take Guided Product Tour"
      >
        <Compass className="w-3.5 h-3.5 text-[#D9A441] animate-spin [animation-duration:8s]" />
        <span>Guide me</span>
      </button>

      {/* Tour Overlay & Spotlight */}
      {activeStep !== null && currentStep && (
        <div className="fixed inset-0 z-[100] pointer-events-auto select-none overflow-hidden font-sans">
          {/* Backdrop with semi-transparent dimming */}
          <div
            className="absolute inset-0 bg-[#0A0C10]/75 backdrop-blur-[2px] transition-opacity duration-300"
            onClick={closeTour}
          />

          {/* Spotlight Highlight Ring around targeted element */}
          {targetRect && (
            <div
              className="absolute rounded-lg border-2 border-[#5B8DEF] shadow-[0_0_25px_rgba(91,141,239,0.7)] pointer-events-none transition-all duration-300 ease-out animate-pulse"
              style={{
                top: targetRect.top - 6,
                left: targetRect.left - 6,
                width: targetRect.width + 12,
                height: targetRect.height + 12,
              }}
            />
          )}

          {/* Tour Callout Tooltip Card with Arrow Pointer */}
          <div
            className="absolute w-80 z-[110] transition-all duration-300 ease-out origin-top-left"
            style={{
              top: tooltipPos.top,
              left: tooltipPos.left,
            }}
          >
            {/* Directional Arrow Pointers */}
            {currentStep.arrowPosition === 'left' && (
              <div className="absolute -left-2 top-5 w-3.5 h-3.5 bg-[#12151C] border-b border-l border-[#5B8DEF] rotate-45 shadow-lg z-[120]" />
            )}
            {currentStep.arrowPosition === 'top' && (
              <div className="absolute -top-2 right-12 w-3.5 h-3.5 bg-[#12151C] border-t border-l border-[#5B8DEF] rotate-45 shadow-lg z-[120]" />
            )}
            {currentStep.arrowPosition === 'bottom' && (
              <div className="absolute -bottom-2 right-12 w-3.5 h-3.5 bg-[#12151C] border-b border-r border-[#5B8DEF] rotate-45 shadow-lg z-[120]" />
            )}
            {currentStep.arrowPosition === 'right' && (
              <div className="absolute -right-2 top-5 w-3.5 h-3.5 bg-[#12151C] border-t border-r border-[#5B8DEF] rotate-45 shadow-lg z-[120]" />
            )}

            <div className="rounded-xl border border-[#5B8DEF]/80 bg-[#12151C]/95 backdrop-blur-xl shadow-[0_15px_40px_rgba(0,0,0,0.8)] overflow-hidden relative z-[115]">
              {/* Card Header */}
              <div className="px-4 py-2.5 border-b border-[#232833] bg-[#0A0C10] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-[#5B8DEF]" />
                  <span className="font-mono text-[10px] font-bold text-[#5B8DEF] uppercase tracking-wider">
                    {currentStep.badge}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={closeTour}
                  className="p-1 rounded text-[#8B92A0] hover:text-[#E8EAED] hover:bg-[#161A22] transition-colors cursor-pointer"
                  title="Close tour"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-2.5">
                <h4 className="font-bold text-sm text-[#E8EAED] tracking-wide flex items-center gap-2">
                  {currentStep.title}
                </h4>
                <p className="text-xs text-[#8B92A0] leading-relaxed">
                  {currentStep.description}
                </p>

                {/* Embedded Video Explanation */}
                {currentStep.videoUrl && (
                  <div className="mt-2 rounded-lg overflow-hidden border border-[#232833] bg-[#0A0C10] shadow-md">
                    {currentStep.videoUrl.includes('youtube.com') ||
                      currentStep.videoUrl.includes('youtu.be') ||
                      currentStep.videoUrl.includes('loom.com') ? (
                      <iframe
                        src={currentStep.videoUrl}
                        title="Mission Video Overview"
                        className="w-full h-36 border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        src={currentStep.videoUrl}
                        controls
                        playsInline
                        className="w-full max-h-56 object-contain bg-black rounded-lg"
                      >
                        Your browser does not support the video tag.
                      </video>
                    )}
                  </div>
                )}
              </div>

              {/* Card Footer Controls */}
              <div className="px-4 py-3 border-t border-[#232833] bg-[#0A0C10] flex items-center justify-between font-mono text-xs">
                <button
                  type="button"
                  onClick={closeTour}
                  className="text-[11px] text-[#4E5462] hover:text-[#8B92A0] transition-colors cursor-pointer"
                >
                  Skip Tour
                </button>

                <div className="flex items-center gap-2">
                  {activeStep > 0 && (
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="px-2.5 py-1 rounded bg-[#161A22] border border-[#232833] text-[#8B92A0] hover:text-[#E8EAED] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-3 py-1.5 rounded bg-[#5B8DEF] hover:bg-[#4A7CE0] text-[#0A0C10] font-bold flex items-center gap-1 shadow-md transition-all cursor-pointer active:scale-95"
                  >
                    {activeStep === TOUR_STEPS.length - 1 ? (
                      <>
                        <span>Finish</span>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
