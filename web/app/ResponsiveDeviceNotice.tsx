'use client';

import React, { useEffect, useState } from 'react';
import { Monitor, Smartphone, X, ChevronRight, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function ResponsiveDeviceNotice() {
  const [showNotice, setShowNotice] = useState(false);
  const [screenInfo, setScreenInfo] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const checkDeviceWidth = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setScreenInfo({ width, height });

      const dismissed = sessionStorage.getItem('chandrasetu_device_notice_dismissed');
      // Detect small window / mobile / tablet screens (< 1024px)
      if (width < 1024 && dismissed !== 'true') {
        setShowNotice(true);
      } else {
        setShowNotice(false);
      }
    };

    // Run on initial mount
    checkDeviceWidth();

    // Listen to window resize events
    window.addEventListener('resize', checkDeviceWidth);
    return () => window.removeEventListener('resize', checkDeviceWidth);
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem('chandrasetu_device_notice_dismissed', 'true');
    setShowNotice(false);
  };

  if (!showNotice) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300 font-sans select-none">
      <div className="relative w-full max-w-lg bg-[#12151C] border border-[#5B8DEF]/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden font-sans text-[#E8EAED]">
        
        {/* Top Header Bar */}
        <div className="bg-[#161A22] px-4 py-3 border-b border-[#232833] flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#D9A441] animate-ping" />
            <span className="text-xs font-bold tracking-wider text-[#D9A441] uppercase flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-[#D9A441]" />
              <span>DISPLAY RESOLUTION NOTICE</span>
            </span>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="w-6 h-6 rounded-md bg-[#0A0C10] border border-[#232833] hover:border-[#5B8DEF] text-[#8B92A0] hover:text-[#E8EAED] flex items-center justify-center transition-colors cursor-pointer"
            title="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Visual Icon Header */}
          <div className="flex items-center justify-center gap-4 py-2">
            <div className="relative p-3 rounded-xl bg-[#0A0C10] border border-[#D9534F]/40 text-[#D9534F]">
              <Smartphone className="w-7 h-7" />
              <span className="absolute -top-1 -right-1 text-[9px] font-mono font-bold bg-[#D9534F] text-[#0A0C10] px-1 rounded">
                {screenInfo.width}px
              </span>
            </div>

            <ChevronRight className="w-5 h-5 text-[#4E5462]" />

            <div className="relative p-3.5 rounded-xl bg-[#0A0C10] border border-[#3FB68B]/40 text-[#3FB68B]">
              <Monitor className="w-8 h-8" />
              <span className="absolute -top-1 -right-1 text-[9px] font-mono font-bold bg-[#3FB68B] text-[#0A0C10] px-1 rounded">
                ≥1024px
              </span>
            </div>
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-lg font-bold text-[#E8EAED] tracking-tight">
              Desktop Display Recommended
            </h3>
            <p className="text-xs text-[#8B92A0] leading-relaxed max-w-md mx-auto">
              ChandraSetu handles sub-pixel lunar image correspondence, high-density satellite telemetry, and multi-sensor GIS mapping. For the best visual precision and smoothest experience, a desktop or larger screen window is recommended.
            </p>
          </div>

          {/* Telemetry pill info */}
          <div className="p-3 rounded-lg bg-[#0A0C10] border border-[#232833] text-[11px] font-mono text-[#8B92A0] flex items-center justify-between">
            <span className="text-[#4E5462]">DETECTED VIEWPORT:</span>
            <span className="text-[#5B8DEF] font-bold">
              {screenInfo.width} × {screenInfo.height} px
            </span>
          </div>

          {/* Action button */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 font-mono">
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-2.5 px-4 rounded-lg bg-[#5B8DEF] hover:bg-[#4A7CE0] text-[#0A0C10] font-sans font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-95"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>CONTINUE ON THIS DEVICE</span>
            </button>
          </div>
        </div>

        {/* Footer info bar */}
        <div className="bg-[#0A0C10] px-4 py-2 border-t border-[#232833] text-[10px] font-mono text-[#4E5462] flex items-center justify-between">
          <span>ISRO CHANDRAYAAN-2 GATEWAY</span>
          <span>CHANDRASETU v1.0</span>
        </div>
      </div>
    </div>
  );
}
