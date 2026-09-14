'use client';

import React from 'react';
import { Construction, Orbit, Layers, ArrowRight, X } from 'lucide-react';

interface EngineDevModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchTo2D?: () => void;
}

export default function EngineDevModal({ isOpen, onClose, onSwitchTo2D }: EngineDevModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 select-none font-sans">
      {/* Blurred Backdrop */}
      <div
        className="absolute inset-0 bg-[#0A0C10]/85 backdrop-blur-xl transition-all duration-300"
        onClick={onClose}
      />

      {/* High-Tech Modal Window */}
      <div className="relative z-[160] w-full max-w-lg rounded-2xl border border-[#5B8DEF]/40 bg-[#12151C]/95 backdrop-blur-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden font-sans animate-in fade-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-[#232833] bg-[#0A0C10] flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-xs text-[#D9A441] font-bold">
            <Construction className="w-4 h-4 text-[#D9A441] animate-bounce" />
            <span className="uppercase tracking-wider">ENGINE DEVELOPMENT IN PROGRESS</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[#8B92A0] hover:text-[#E8EAED] hover:bg-[#161A22] transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#5B8DEF]/10 border border-[#5B8DEF]/30 flex items-center justify-center text-[#5B8DEF] shrink-0 shadow-inner">
              <Orbit className="w-6 h-6 animate-spin [animation-duration:6s]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#E8EAED] tracking-wide">
                3D Selenographic WebGL Engine
              </h3>
              <span className="text-[11px] font-mono text-[#5B8DEF]">
                CHANDRASETU v2.4 · ACTIVE BUILD
              </span>
            </div>
          </div>

          <p className="text-xs text-[#8B92A0] leading-relaxed">
            Our engineering team is actively building out the high-resolution 3D WebGL selenographic rendering engine with real-time ISRO Chandrayaan-2 Digital Elevation Models (DEM) and sub-pixel displacement mapping.
          </p>

          {/* Development Status Badges */}
          <div className="bg-[#0A0C10] p-3.5 rounded-xl border border-[#232833] font-mono text-xs space-y-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#8B92A0] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#3FB68B] shadow-[0_0_6px_rgba(63,182,139,0.8)]" />
                <span>2D Sub-Pixel Co-Registration:</span>
              </span>
              <span className="text-[#3FB68B] font-bold">OPERATIONAL</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#8B92A0] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D9A441] animate-ping" />
                <span>3D DEM Surface Displacement:</span>
              </span>
              <span className="text-[#D9A441] font-bold">IN ACTIVE BUILD</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#8B92A0] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#3FB68B] shadow-[0_0_6px_rgba(63,182,139,0.8)]" />
                <span>SPICE & PDS4 Metadata Pipeline:</span>
              </span>
              <span className="text-[#3FB68B] font-bold">READY</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#232833] bg-[#0A0C10] flex items-center justify-end gap-3 font-mono">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#161A22] border border-[#232833] hover:border-[#8B92A0] text-[#8B92A0] hover:text-[#E8EAED] text-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span>Understood</span>
          </button>

          {onSwitchTo2D && (
            <button
              type="button"
              onClick={onSwitchTo2D}
              className="px-4 py-2 rounded-lg bg-[#5B8DEF] hover:bg-[#4A7CE0] text-[#0A0C10] font-sans font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Use 2D Inspector</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
