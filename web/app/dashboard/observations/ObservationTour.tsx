'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { HelpCircle, ChevronRight, ChevronLeft, X, AlertCircle, Compass, CheckCircle2 } from 'lucide-react';

export interface ObsTourStep {
  targetSelector: string;
  title: string;
  description: string;
  badge: string;
  arrowPosition?: 'left' | 'top' | 'bottom' | 'right';
}

const OBS_TOUR_STEPS: ObsTourStep[] = [
  {
    targetSelector: '[data-tour="obs-back-3d"]',
    title: 'Return to 3D Orbit Moon',
    description: 'Switch from 2D pixel inspection back to the interactive 3D selenographic WebGL Moon globe.',
    badge: 'Step 1 of 7',
    arrowPosition: 'bottom',
  },
  {
    targetSelector: '[data-tour="obs-filter-mode"]',
    title: 'High Contrast & Shadow Boost Filters',
    description: 'Cycle image processing filters (High Contrast, Shadow Boost, Standard) to accentuate crater rims, shadows, and low-albedo surface features.',
    badge: 'Step 2 of 7',
    arrowPosition: 'bottom',
  },
  {
    targetSelector: '[data-tour="obs-layer-selector"]',
    title: 'Multi-Layer Comparison Modes',
    description: 'Compare co-registered layers: Split Slider (swipe comparison), Image A (co-registered source), Image B (reference orbit), or Difference Overlay (residual error map).',
    badge: 'Step 3 of 7',
    arrowPosition: 'bottom',
  },
  {
    targetSelector: '[data-tour="obs-canvas"]',
    title: 'Click-to-Probe Lunar Surface Canvas',
    description: 'Click anywhere on the lunar surface to pin a target crater reticle with full axis crosshairs and calculate exact pixel coordinates.',
    badge: 'Step 4 of 7',
    arrowPosition: 'top',
  },
  {
    targetSelector: '[data-tour="obs-inspector-hud"]',
    title: 'Lunar Pixel Inspector & Nudge HUD',
    description: 'Displays real-time pixel coordinates, 1:1 OpenCV co-registration lock status (<0.28 px RMSE), and fine sub-pixel nudge controls.',
    badge: 'Step 5 of 7',
    arrowPosition: 'right',
  },
  {
    targetSelector: '[data-tour="obs-nudge-controls"]',
    title: 'Sub-Pixel Micro-Nudge (◀ ▲ ▼ ▶)',
    description: 'Use the directional arrow buttons to shift Image A by sub-pixel increments to test micro-alignment against the reference frame.',
    badge: 'Step 6 of 7',
    arrowPosition: 'top',
  },
  {
    targetSelector: '[data-tour="obs-zoom-controls"]',
    title: 'Zoom, Pan & Reticle Display',
    description: 'Zoom up to 800%, reset canvas pan/zoom scale, and toggle reticle crosshair lines ON or OFF.',
    badge: 'Step 7 of 7',
    arrowPosition: 'top',
  },
];

interface ObservationTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ObservationTour({ isOpen, onClose }: ObservationTourProps) {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updateHighlight = useCallback(() => {
    if (!isOpen) {
      setTargetRect(null);
      return;
    }

    const step = OBS_TOUR_STEPS[activeStep];
    const element = document.querySelector(step.targetSelector);

    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);

      // Compute tooltip coordinates safely within viewport
      const tooltipWidth = 340;
      const tooltipHeight = 220;
      const padding = 16;

      let top = rect.bottom + padding;
      let left = rect.left + rect.width / 2 - tooltipWidth / 2;

      if (step.arrowPosition === 'bottom') {
        top = rect.top - tooltipHeight - padding;
      } else if (step.arrowPosition === 'left') {
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + padding;
      } else if (step.arrowPosition === 'right') {
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - padding;
      }

      // Constrain inside viewport
      if (left < padding) left = padding;
      if (left + tooltipWidth > window.innerWidth - padding) {
        left = window.innerWidth - tooltipWidth - padding;
      }
      if (top < padding) top = padding;
      if (top + tooltipHeight > window.innerHeight - padding) {
        top = window.innerHeight - tooltipHeight - padding;
      }

      setTooltipPos({ top, left });
    } else {
      setTargetRect(null);
    }
  }, [isOpen, activeStep]);

  useEffect(() => {
    if (isOpen) {
      setActiveStep(0);
    }
  }, [isOpen]);

  useEffect(() => {
    updateHighlight();
    window.addEventListener('resize', updateHighlight);
    window.addEventListener('scroll', updateHighlight, true);

    return () => {
      window.removeEventListener('resize', updateHighlight);
      window.removeEventListener('scroll', updateHighlight, true);
    };
  }, [updateHighlight]);

  if (!isOpen) return null;

  const currentStep = OBS_TOUR_STEPS[activeStep];

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto select-none">
      {/* Dimmed Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300" />

      {/* Target Highlight Ring */}
      {targetRect && (
        <div
          style={{
            top: `${targetRect.top - 6}px`,
            left: `${targetRect.left - 6}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
          }}
          className="absolute rounded-xl border-2 border-[#5B8DEF] shadow-[0_0_30px_#5B8DEF80] pointer-events-none transition-all duration-300 ease-out z-50 animate-pulse"
        />
      )}

      {/* Tour Step Tooltip Card */}
      <div
        style={{
          top: `${tooltipPos.top}px`,
          left: `${tooltipPos.left}px`,
        }}
        className="absolute z-50 w-80 sm:w-96 font-mono text-xs text-[#E8EAED] transition-all duration-300 ease-out"
      >
        {/* Directional Arrow Pointers */}
        {currentStep.arrowPosition === 'left' && (
          <div className="absolute -left-2 top-6 w-3.5 h-3.5 bg-[#12151C] border-b border-l border-[#5B8DEF] rotate-45 shadow-lg z-[120]" />
        )}
        {currentStep.arrowPosition === 'top' && (
          <div className="absolute -top-2 right-12 w-3.5 h-3.5 bg-[#12151C] border-t border-l border-[#5B8DEF] rotate-45 shadow-lg z-[120]" />
        )}
        {currentStep.arrowPosition === 'bottom' && (
          <div className="absolute -bottom-2 right-12 w-3.5 h-3.5 bg-[#12151C] border-b border-r border-[#5B8DEF] rotate-45 shadow-lg z-[120]" />
        )}
        {currentStep.arrowPosition === 'right' && (
          <div className="absolute -right-2 top-6 w-3.5 h-3.5 bg-[#12151C] border-t border-r border-[#5B8DEF] rotate-45 shadow-lg z-[120]" />
        )}

        <div className="bg-[#12151C] border border-[#5B8DEF]/60 rounded-xl p-4 shadow-2xl backdrop-blur-xl relative z-[115] space-y-3">
          {/* Step Header */}
          <div className="flex items-center justify-between border-b border-[#232833] pb-2">
            <div className="flex items-center gap-2 text-[#5B8DEF] font-bold text-xs">
              <Compass className="w-4 h-4 animate-spin-slow" />
              <span>Observation Helper</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-[#5B8DEF]/15 text-[#5B8DEF] text-[10px] font-bold border border-[#5B8DEF]/30">
                {currentStep.badge}
              </span>
              <button
                onClick={onClose}
                className="text-[#8B92A0] hover:text-[#E8EAED] transition-colors p-1 cursor-pointer"
                title="Close Guide"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <h4 className="font-bold text-[#E8EAED] text-sm flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-[#5B8DEF]" />
              {currentStep.title}
            </h4>
            <p className="text-[#8B92A0] text-xs leading-relaxed font-sans">
              {currentStep.description}
            </p>
          </div>

          {/* Footer Navigation Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-[#232833]">
            <button
              onClick={onClose}
              className="text-[11px] text-[#8B92A0] hover:text-[#E8EAED] underline cursor-pointer"
            >
              End Helper
            </button>

            <div className="flex items-center gap-2">
              <button
                disabled={activeStep === 0}
                onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
                className="px-2.5 py-1 rounded-md bg-[#161A22] border border-[#232833] text-[#8B92A0] hover:text-[#E8EAED] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 text-[11px]"
              >
                <ChevronLeft className="w-3 h-3" />
                Prev
              </button>

              {activeStep < OBS_TOUR_STEPS.length - 1 ? (
                <button
                  onClick={() => setActiveStep((prev) => Math.min(OBS_TOUR_STEPS.length - 1, prev + 1))}
                  className="px-3 py-1 rounded-md bg-[#5B8DEF] text-[#0A0C10] font-bold hover:bg-[#4A7BDC] cursor-pointer flex items-center gap-1 text-[11px] transition-colors"
                >
                  Next
                  <ChevronRight className="w-3 h-3" />
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="px-3 py-1 rounded-md bg-[#3FB68B] text-[#0A0C10] font-bold hover:bg-[#329B75] cursor-pointer flex items-center gap-1 text-[11px] transition-colors"
                >
                  Done
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
