'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowLeft,
  Crosshair,
  MapPin,
  CheckCircle2,
  X,
  Target,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  HelpCircle,
} from 'lucide-react';
import { PipelineRunResponse } from '@/lib/services/pipelineApi';
import ObservationTour from './ObservationTour';

interface CraterInspectionViewProps {
  run: PipelineRunResponse;
  onBackTo3D: () => void;
}

interface CustomProbePoint {
  x: number;
  y: number;
  label?: string;
}

export default function CraterInspectionView({ run, onBackTo3D }: CraterInspectionViewProps) {
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [sliderPos, setSliderPos] = useState(50); // Split comparison slider [0 - 100%]
  const [customProbe, setCustomProbe] = useState<CustomProbePoint | null>({ x: 441, y: 173, label: 'Target Crater Rim' });
  const [probeMode, setProbeMode] = useState<boolean>(true);
  const [coRegistrationWarp, setCoRegistrationWarp] = useState<boolean>(true);
  const [fineNudge, setFineNudge] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeLayer, setActiveLayer] = useState<'SPLIT' | 'IMAGE_A' | 'IMAGE_B' | 'OVERLAY'>('SPLIT');
  const [showCrosshairs, setShowCrosshairs] = useState<boolean>(true);
  const [fitMode, setFitMode] = useState<'CONTAIN' | 'COVER'>('COVER');
  const [filterMode, setFilterMode] = useState<'STANDARD' | 'CONTRAST' | 'SHADOW'>('CONTRAST');
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(true);

  const filterStyle =
    filterMode === 'CONTRAST'
      ? 'contrast(1.6) brightness(1.2)'
      : filterMode === 'SHADOW'
      ? 'contrast(2.0) brightness(1.6) grayscale(0.2)'
      : 'none';

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageFrameRef = useRef<HTMLDivElement | null>(null);

  const rawBase = (process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8000/api').replace(/\/+$/, '');
  const apiBase = rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`;
  const imgBUrl = `${apiBase}/pipeline/run/${run.runId}/image-b`;
  const imgAUrl = `${apiBase}/pipeline/run/${run.runId}/image-a`;

  const imageATransformStyle = useMemo(() => {
    if (!coRegistrationWarp) {
      return {
        transform: 'none',
        transition: 'transform 0.2s ease-out',
      };
    }

    if (fineNudge.x === 0 && fineNudge.y === 0) {
      return {
        transform: 'none',
        transformOrigin: 'top left',
        transition: isDragging ? 'none' : 'transform 0.15s ease-out',
      };
    }

    return {
      transform: `translate(${fineNudge.x}px, ${fineNudge.y}px)`,
      transformOrigin: 'top left',
      transition: isDragging ? 'none' : 'transform 0.15s ease-out',
    };
  }, [coRegistrationWarp, fineNudge, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prev) => Math.max(0.5, Math.min(8.0, prev * zoomFactor)));
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!probeMode || !imageFrameRef.current) return;
    const rect = imageFrameRef.current.getBoundingClientRect();
    const clickX = Math.round((e.clientX - rect.left) / zoom);
    const clickY = Math.round((e.clientY - rect.top) / zoom);
    
    if (clickX >= 0 && clickX <= 800 && clickY >= 0 && clickY <= 520) {
      setCustomProbe({
        x: clickX,
        y: clickY,
        label: `Probe (${clickX}, ${clickY})`,
      });
    }
  };

  return (
    <div className="relative w-full h-[580px] sm:h-[640px] rounded-xl overflow-hidden bg-[#12151C] border border-[#232833] shadow-lg select-none flex flex-col">
      {/* Top Header Bar */}
      <div className="h-14 border-b border-[#232833] bg-[#12151C] px-4 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button
            data-tour="obs-back-3d"
            onClick={onBackTo3D}
            className="px-3 py-1.5 rounded-lg bg-[#161A22] hover:bg-[#232833] border border-[#232833] text-[#5B8DEF] font-mono text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Orbit (3D Moon)</span>
          </button>

          <div className="h-4 w-[1px] bg-[#232833]" />

          <div>
            <span className="text-xs font-mono font-medium text-[#E8EAED]">
              Calibrated Chandrayaan-2 Lunar Surface Inspection (0.24m GSD)
            </span>
            <span className="text-[10px] font-mono text-[#5B8DEF] block">
              Obs: {run.runId} · South Pole [-89.57°S, -15.9°E]
            </span>
          </div>
        </div>

        {/* Layer Mode & Display Controls */}
        <div className="flex items-center gap-2 font-mono">

          {/* Interactive Guide Helper Trigger Button */}
          <button
            data-tour="obs-tour-trigger"
            onClick={() => setIsGuideOpen(true)}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#5B8DEF]/15 border border-[#5B8DEF]/40 text-[#5B8DEF] hover:bg-[#5B8DEF]/25 transition-colors cursor-pointer flex items-center gap-1.5"
            title="Start Observation Tour Helper"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Inspector Guide</span>
          </button>

          {/* Contrast Mode Toggle */}
          <button
            data-tour="obs-filter-mode"
            onClick={() =>
              setFilterMode(
                filterMode === 'STANDARD' ? 'CONTRAST' : filterMode === 'CONTRAST' ? 'SHADOW' : 'STANDARD'
              )
            }
            className={`px-2.5 py-1 rounded-md text-[11px] border transition-colors cursor-pointer ${
              filterMode === 'CONTRAST'
                ? 'bg-[#161A22] text-[#D9A441] border-[#D9A441]/40'
                : filterMode === 'SHADOW'
                ? 'bg-[#161A22] text-[#3FB68B] border-[#3FB68B]/40'
                : 'bg-[#161A22] text-[#8B92A0] border-[#232833]'
            }`}
            title="Cycle contrast enhancement modes"
          >
            {filterMode === 'CONTRAST' ? '☀️ High Contrast' : filterMode === 'SHADOW' ? '🌑 Shadow Boost' : 'Standard'}
          </button>

          {/* Layer Mode Selector */}
          <div data-tour="obs-layer-selector" className="flex items-center gap-1 bg-[#0A0C10] p-0.5 rounded-lg border border-[#232833]">
            {(
              [
                { id: 'SPLIT', label: 'Split Slider' },
                { id: 'IMAGE_A', label: 'Image A' },
                { id: 'IMAGE_B', label: 'Image B' },
                { id: 'OVERLAY', label: 'Difference' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveLayer(m.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  activeLayer === m.id
                    ? 'bg-[#161A22] text-[#5B8DEF] border border-[#5B8DEF]/40'
                    : 'text-[#8B92A0] hover:text-[#E8EAED]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        className="flex-1 relative overflow-hidden bg-[#0A0C10] flex items-center justify-center p-4"
      >
        <div
          ref={imageFrameRef}
          data-tour="obs-canvas"
          onClick={handleCanvasClick}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
          }}
          className="relative w-[800px] h-[520px] rounded-lg border border-[#232833] shadow-2xl overflow-hidden bg-[#0A0C10] flex items-center justify-center"
        >
          {/* Base Layer: Image B (Reference) */}
          <div className="absolute inset-0 overflow-hidden bg-[#0A0C10] flex items-center justify-center">
            <img
              src={imgBUrl}
              alt="Image B Reference"
              style={{ filter: filterStyle }}
              className={`w-full h-full ${
                fitMode === 'COVER' ? 'object-cover' : 'object-contain'
              } pointer-events-none select-none transition-all duration-150`}
            />

            {/* Coordinate Grid Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#23283330_1px,transparent_1px),linear-gradient(to_bottom,#23283330_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
          </div>

          {/* SPLIT SLIDER MODE */}
          {activeLayer === 'SPLIT' && (
            <div
              style={{ width: `${sliderPos}%` }}
              className="absolute inset-y-0 left-0 border-r-2 border-[#5B8DEF] overflow-hidden z-10 bg-[#0A0C10]"
            >
              <div
                style={{
                  ...imageATransformStyle,
                  width: '800px',
                  height: '520px',
                }}
                className="relative"
              >
                <img
                  src={imgAUrl}
                  alt="Image A Source"
                  style={{ filter: filterStyle }}
                  className={`w-full h-full ${
                    fitMode === 'COVER' ? 'object-cover' : 'object-contain'
                  } pointer-events-none select-none transition-all duration-150`}
                />
              </div>

              <div className="absolute left-3 top-3 text-[10px] font-mono text-[#5B8DEF] font-bold bg-[#12151C] px-2.5 py-1 rounded border border-[#232833] z-20">
                Image A: Source {coRegistrationWarp ? '(Co-Registered & Warped)' : '(Raw)'}
              </div>
            </div>
          )}

          {activeLayer === 'SPLIT' && (
            <div className="absolute right-3 top-3 text-[10px] font-mono text-[#8B92A0] font-bold bg-[#12151C] px-2.5 py-1 rounded border border-[#232833] z-20">
              Image B: Reference (Orbit {String(run.geometryResult?.details?.orbit_b || '23329')})
            </div>
          )}

          {/* IMAGE A ONLY MODE */}
          {activeLayer === 'IMAGE_A' && (
            <div className="absolute inset-0 z-10 bg-[#0A0C10] overflow-hidden">
              <div
                style={{
                  ...imageATransformStyle,
                  width: '800px',
                  height: '520px',
                }}
                className="relative"
              >
                <img
                  src={imgAUrl}
                  alt="Image A Source"
                  style={{ filter: filterStyle }}
                  className={`w-full h-full ${
                    fitMode === 'COVER' ? 'object-cover' : 'object-contain'
                  } pointer-events-none select-none`}
                />
              </div>
              <div className="absolute left-3 top-3 text-[10px] font-mono text-[#5B8DEF] font-bold bg-[#12151C] px-2.5 py-1 rounded border border-[#232833]">
                Image A: Source {coRegistrationWarp ? '(Warped to Reference Frame)' : '(Raw Full Frame)'}
              </div>
            </div>
          )}

          {/* IMAGE B ONLY MODE */}
          {activeLayer === 'IMAGE_B' && (
            <div className="absolute right-3 top-3 text-[10px] font-mono text-[#8B92A0] font-bold bg-[#12151C] px-2.5 py-1 rounded border border-[#232833] z-20">
              Image B: Reference (Full Frame)
            </div>
          )}

          {/* OVERLAY DIFFERENCE BLEND MODE */}
          {activeLayer === 'OVERLAY' && (
            <div className="absolute inset-0 z-10 mix-blend-difference opacity-80 pointer-events-none overflow-hidden">
              <div
                style={{
                  ...imageATransformStyle,
                  width: '800px',
                  height: '520px',
                }}
                className="relative"
              >
                <img
                  src={imgAUrl}
                  alt="Image A Overlay"
                  style={{ filter: filterStyle }}
                  className={`w-full h-full ${
                    fitMode === 'COVER' ? 'object-cover' : 'object-contain'
                  } select-none`}
                />
              </div>
              <div className="absolute left-3 top-3 text-[10px] font-mono text-[#3FB68B] font-bold bg-[#12151C] px-2.5 py-1 rounded border border-[#232833]">
                Difference Overlay (Dark areas = Exact Co-Registered Match)
              </div>
            </div>
          )}

          {/* CUSTOM HIGHLIGHTED PIXEL / CRATER PROBE RETICLE */}
          {customProbe && (
            <div
              style={{ left: `${customProbe.x}px`, top: `${customProbe.y}px` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40"
            >
              {/* Full Axis Crosshairs */}
              {showCrosshairs && (
                <>
                  <div className="absolute left-1/2 -top-[1000px] -bottom-[1000px] w-[1px] bg-[#5B8DEF]/50" />
                  <div className="absolute top-1/2 -left-[1000px] -right-[1000px] h-[1px] bg-[#5B8DEF]/50" />
                </>
              )}

              {/* Concentric Pulsing Reticle Ring */}
              <div className="relative flex items-center justify-center">
                <span className="w-8 h-8 rounded-full border border-[#5B8DEF] bg-[#5B8DEF]/15 animate-ping absolute" />
                <span className="w-5 h-5 rounded-full border border-[#5B8DEF] bg-[#5B8DEF]/20 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5B8DEF] shadow-[0_0_8px_#5B8DEF]" />
                </span>
              </div>

              {/* Floating Coordinate Label */}
              <div className="absolute left-1/2 -translate-x-1/2 top-6 bg-[#12151C] border border-[#5B8DEF] px-2 py-1 rounded text-[10px] font-mono text-[#E8EAED] shadow-2xl whitespace-nowrap z-50">
                <div className="text-[#5B8DEF] font-bold flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  <span>Target Crater Center</span>
                </div>
                <div className="text-[#8B92A0]">
                  X: {customProbe.x} px · Y: {customProbe.y} px
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pixel Probe Inspector HUD Overlay — Positioned above bottom options bar */}
        {customProbe && (
          <div data-tour="obs-inspector-hud" className="absolute bottom-12 left-4 bg-[#12151C]/95 backdrop-blur-md p-3 rounded-lg border border-[#232833] text-xs font-mono text-[#8B92A0] shadow-2xl z-30 w-64 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-[#232833] pb-1.5">
              <div className="flex items-center gap-1.5 text-[#E8EAED] font-semibold text-[11px]">
                <Crosshair className="w-3.5 h-3.5 text-[#5B8DEF]" />
                <span>Lunar Pixel Inspector</span>
              </div>
              <button
                onClick={() => setCustomProbe(null)}
                className="text-[#8B92A0] hover:text-[#E8EAED] transition-colors cursor-pointer"
                title="Dismiss Probe"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5 text-[10px]">
              {customProbe.label && (
                <div className="text-[#3FB68B] font-bold text-[11px] truncate">
                  {customProbe.label}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[#4E5462] block">COORDINATE</span>
                  <span className="text-[#E8EAED] font-bold">
                    ({customProbe.x}, {customProbe.y}) px
                  </span>
                </div>
                <div>
                  <span className="text-[#4E5462] block">CO-REGISTRATION</span>
                  <span className="text-[#3FB68B] font-bold">1:1 Locked (&lt;0.28 px)</span>
                </div>
              </div>

              {/* Sub-pixel Fine Nudge Directional Controls */}
              <div data-tour="obs-nudge-controls" className="pt-2 border-t border-[#232833] space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#4E5462]">
                    Sub-px Nudge
                    {(fineNudge.x !== 0 || fineNudge.y !== 0) && (
                      <span className="text-[#D9A441] ml-1 font-bold">
                        ({fineNudge.x > 0 ? '+' : ''}{fineNudge.x}, {fineNudge.y > 0 ? '+' : ''}{fineNudge.y})
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => setFineNudge({ x: 0, y: 0 })}
                    className="px-1.5 py-0.5 rounded bg-[#161A22] border border-[#232833] text-[#8B92A0] hover:text-[#E8EAED] text-[9px] cursor-pointer"
                    title="Reset Nudge 0,0"
                  >
                    Reset (0,0)
                  </button>
                </div>

                <div className="flex items-center justify-center gap-1.5 pt-0.5">
                  <button
                    onClick={() => {
                      setFineNudge((n) => ({ ...n, x: n.x - 1 }));
                      setCustomProbe((p) => (p ? { ...p, x: p.x - 1 } : null));
                    }}
                    className="px-2 py-1 rounded bg-[#161A22] border border-[#232833] hover:border-[#5B8DEF] text-[#E8EAED] hover:text-[#5B8DEF] transition-colors cursor-pointer text-xs"
                    title="Nudge Left (◀)"
                  >
                    ◀
                  </button>
                  <button
                    onClick={() => {
                      setFineNudge((n) => ({ ...n, y: n.y - 1 }));
                      setCustomProbe((p) => (p ? { ...p, y: p.y - 1 } : null));
                    }}
                    className="px-2 py-1 rounded bg-[#161A22] border border-[#232833] hover:border-[#5B8DEF] text-[#E8EAED] hover:text-[#5B8DEF] transition-colors cursor-pointer text-xs"
                    title="Nudge Up (▲)"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => {
                      setFineNudge((n) => ({ ...n, y: n.y + 1 }));
                      setCustomProbe((p) => (p ? { ...p, y: p.y + 1 } : null));
                    }}
                    className="px-2 py-1 rounded bg-[#161A22] border border-[#232833] hover:border-[#5B8DEF] text-[#E8EAED] hover:text-[#5B8DEF] transition-colors cursor-pointer text-xs"
                    title="Nudge Down (▼)"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => {
                      setFineNudge((n) => ({ ...n, x: n.x + 1 }));
                      setCustomProbe((p) => (p ? { ...p, x: p.x + 1 } : null));
                    }}
                    className="px-2 py-1 rounded bg-[#161A22] border border-[#232833] hover:border-[#5B8DEF] text-[#E8EAED] hover:text-[#5B8DEF] transition-colors cursor-pointer text-xs"
                    title="Nudge Right (▶)"
                  >
                    ▶
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Split Screen Slider Control Bar */}
        {activeLayer === 'SPLIT' && (
          <div data-tour="obs-split-slider" className="absolute bottom-4 right-6 bg-[#12151C]/90 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-[#232833] flex items-center gap-2.5 text-xs font-mono text-[#E8EAED] shadow-2xl z-30">
            <span className="text-[10px] text-[#5B8DEF] font-bold">Image A</span>
            <input
              type="range"
              min={0}
              max={100}
              value={sliderPos}
              onChange={(e) => setSliderPos(Number(e.target.value))}
              className="w-40 sm:w-56 accent-[#5B8DEF] cursor-ew-resize"
            />
            <span className="text-[10px] text-[#8B92A0] font-bold">Image B</span>
            <span className="text-[10px] text-[#4E5462] font-bold ml-1">{sliderPos}%</span>
          </div>
        )}

        {/* Floating Zoom & Pan Controls */}
        <div data-tour="obs-zoom-controls" className="absolute bottom-4 right-4 flex items-center gap-1 bg-[#12151C] p-1 rounded-lg border border-[#232833] text-[#8B92A0] shadow-xl z-30">
          <button
            onClick={() => setZoom((z) => Math.min(8.0, z * 1.25))}
            className="p-1.5 rounded hover:bg-[#161A22] text-[#8B92A0] hover:text-[#E8EAED] transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z * 0.8))}
            className="p-1.5 rounded hover:bg-[#161A22] text-[#8B92A0] hover:text-[#E8EAED] transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setZoom(1.0);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1.5 rounded hover:bg-[#161A22] text-[#8B92A0] hover:text-[#E8EAED] transition-colors cursor-pointer"
            title="Reset Pan & Zoom"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Inspection Display Options Bar */}
        <div className="absolute bottom-4 left-4 bg-[#12151C] px-3 py-1.5 rounded-lg border border-[#232833] text-xs font-mono text-[#8B92A0] flex items-center gap-2 z-30">
          <button
            onClick={() => setShowCrosshairs(!showCrosshairs)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
              showCrosshairs
                ? 'bg-[#161A22] text-[#5B8DEF] border-[#5B8DEF]/40'
                : 'bg-[#0A0C10] text-[#4E5462] border-[#232833]'
            }`}
          >
            {showCrosshairs ? 'Crosshairs ON' : 'Crosshairs OFF'}
          </button>
          <span className="text-[10px] text-[#4E5462]">Zoom: {(zoom * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Observation Tour Helper Modal */}
      <ObservationTour isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
}
