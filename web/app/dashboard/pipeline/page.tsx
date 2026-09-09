'use client';

import React, { useState } from 'react';
import { Orbit, Upload, Layers, Sparkles, CheckCircle2, XCircle, AlertTriangle, FileCode, Compass, Database, Cpu, RefreshCw } from 'lucide-react';
import { useGetSamplesQuery, useRegisterSampleMutation, useRegisterPairMutation, PipelineRunResponse } from '@/lib/services/pipelineApi';

export default function PipelinePage() {
  const { data: samples } = useGetSamplesQuery();
  const [registerSample, { isLoading: isSampleSubmitting }] = useRegisterSampleMutation();
  const [registerPair, { isLoading: isPairSubmitting }] = useRegisterPairMutation();

  const [activeRun, setActiveRun] = useState<PipelineRunResponse | null>(null);
  const [activeError, setActiveError] = useState<string | null>(null);

  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [xmlA, setXmlA] = useState<File | null>(null);
  const [xmlB, setXmlB] = useState<File | null>(null);
  const [instA, setInstA] = useState<'OHRC' | 'TMC' | 'IIRS'>('OHRC');
  const [instB, setInstB] = useState<'OHRC' | 'TMC' | 'IIRS'>('TMC');

  const handleRunSample = async (sampleId: string) => {
    setActiveError(null);
    try {
      const result = await registerSample({ sampleId }).unwrap();
      setActiveRun(result);
    } catch (err: unknown) {
      const errorObj = err as { data?: { message?: string }; message?: string };
      setActiveError(errorObj?.data?.message || errorObj?.message || 'Failed to trigger sample pipeline');
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileA || !fileB) {
      setActiveError('Please upload both Image A and Image B.');
      return;
    }

    setActiveError(null);
    const formData = new FormData();
    formData.append('imageA', fileA);
    formData.append('imageB', fileB);
    if (xmlA) formData.append('xmlA', xmlA);
    if (xmlB) formData.append('xmlB', xmlB);
    formData.append('instrumentA', instA);
    formData.append('instrumentB', instB);

    try {
      const result = await registerPair(formData).unwrap();
      setActiveRun(result);
    } catch (err: unknown) {
      const errorObj = err as { data?: { message?: string }; message?: string };
      setActiveError(errorObj?.data?.message || errorObj?.message || 'Failed to upload and start registration');
    }
  };

  const isSubmitting = isSampleSubmitting || isPairSubmitting;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Layers className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight font-sans">
              Lunar Registration Pipeline
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Chandrayaan-2 Multi-Instrument Geolocation & Correspondence Engine (SIH26166)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Quick Demo:</span>
          {samples?.map((sample) => (
            <button
              key={sample.id}
              onClick={() => handleRunSample(sample.id)}
              disabled={isSubmitting}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${sample.id.includes('no_match')
                  ? 'bg-rose-950/40 border-rose-600/40 text-rose-300 hover:bg-rose-900/60'
                  : 'bg-cyan-950/50 border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/60 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                }`}
            >
              {sample.id.includes('no_match') ? (
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span>{sample.id.includes('no_match') ? 'Negative Control' : 'Boguslawsky Crater (OHRC↔TMC)'}</span>
            </button>
          ))}
        </div>
      </div>

      {activeError && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs font-mono flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Pipeline Alert</div>
            <div>{activeError}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleManualSubmit} className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800/90 shadow-[0_4px_24px_rgba(0,0,0,0.8)] space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-xs font-mono font-bold text-slate-300 tracking-wider uppercase flex items-center gap-2">
                <Upload className="w-4 h-4 text-cyan-400" />
                Step 0: Upload Image Pair
              </h2>
              <span className="text-[10px] font-mono text-cyan-400/80 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
                PDS4 Ready
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-300 font-mono">Image A (Source / Moving)</span>
                <select
                  value={instA}
                  onChange={(e) => setInstA(e.target.value as 'OHRC' | 'TMC' | 'IIRS')}
                  className="bg-slate-950 border border-slate-700 text-[11px] font-mono rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="OHRC">OHRC (0.25m High-Res)</option>
                  <option value="TMC">TMC-2 (5.0m Optical)</option>
                  <option value="IIRS">IIRS (Hyperspectral)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="border border-dashed border-slate-700 hover:border-cyan-500/70 rounded-lg p-2.5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-950/60 text-center">
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.tif,.tiff,.img,.cub"
                    className="hidden"
                    onChange={(e) => setFileA(e.target.files?.[0] || null)}
                  />
                  <Database className="w-4 h-4 text-slate-400 mb-1" />
                  <span className="text-[11px] text-slate-300 font-mono truncate max-w-full">
                    {fileA ? fileA.name : 'Image (.img/.tif/.png)'}
                  </span>
                </label>

                <label className="border border-dashed border-slate-700 hover:border-cyan-500/70 rounded-lg p-2.5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-950/60 text-center">
                  <input
                    type="file"
                    accept=".xml"
                    className="hidden"
                    onChange={(e) => setXmlA(e.target.files?.[0] || null)}
                  />
                  <FileCode className="w-4 h-4 text-slate-400 mb-1" />
                  <span className="text-[11px] text-slate-300 font-mono truncate max-w-full">
                    {xmlA ? xmlA.name : 'PDS4 Label (.xml)'}
                  </span>
                </label>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300 font-mono">Image B (Reference / Fixed)</span>
                <select
                  value={instB}
                  onChange={(e) => setInstB(e.target.value as 'OHRC' | 'TMC' | 'IIRS')}
                  className="bg-slate-950 border border-slate-700 text-[11px] font-mono rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-purple-500"
                >
                  <option value="TMC">TMC-2 (5.0m Optical)</option>
                  <option value="OHRC">OHRC (0.25m High-Res)</option>
                  <option value="IIRS">IIRS (Hyperspectral)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="border border-dashed border-slate-700 hover:border-purple-500/70 rounded-lg p-2.5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-950/60 text-center">
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.tif,.tiff,.img,.cub"
                    className="hidden"
                    onChange={(e) => setFileB(e.target.files?.[0] || null)}
                  />
                  <Database className="w-4 h-4 text-slate-400 mb-1" />
                  <span className="text-[11px] text-slate-300 font-mono truncate max-w-full">
                    {fileB ? fileB.name : 'Image (.img/.tif/.png)'}
                  </span>
                </label>

                <label className="border border-dashed border-slate-700 hover:border-purple-500/70 rounded-lg p-2.5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-950/60 text-center">
                  <input
                    type="file"
                    accept=".xml"
                    className="hidden"
                    onChange={(e) => setXmlB(e.target.files?.[0] || null)}
                  />
                  <FileCode className="w-4 h-4 text-slate-400 mb-1" />
                  <span className="text-[11px] text-slate-300 font-mono truncate max-w-full">
                    {xmlB ? xmlB.name : 'PDS4 Label (.xml)'}
                  </span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-slate-950 font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Orbital Telemetry...</span>
                </>
              ) : (
                <>
                  <Orbit className="w-4 h-4" />
                  <span>Initiate Pipeline Execution</span>
                </>
              )}
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800/90 shadow-[0_4px_24px_rgba(0,0,0,0.8)] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-xs font-mono font-bold text-slate-300 tracking-wider uppercase flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                Pipeline Orchestrator Stages
              </h2>
              {activeRun && (
                <span className="text-[11px] font-mono text-slate-400">
                  Run ID: <span className="text-cyan-400 font-bold">{activeRun.runId}</span>
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div
                className={`p-3.5 rounded-xl border transition-all ${activeRun?.geometryResult?.status === 'SUCCESS'
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : activeRun?.geometryResult?.status === 'NO_OVERLAP' || activeRun?.geometryResult?.status === 'INSUFFICIENT_GEODATA'
                      ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                      : activeRun
                        ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-300'
                        : 'bg-slate-900/40 border-slate-800/80 text-slate-400'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-slate-950 flex items-center justify-center font-mono font-bold text-xs border border-slate-800">
                      1
                    </div>
                    <div>
                      <div className="text-xs font-bold font-sans">
                        Camera Geometry & Cartographic Alignment
                      </div>
                      <div className="text-[11px] font-mono opacity-80">
                        ISRO PDS4 Metadata & Orbit Frame Transform
                      </div>
                    </div>
                  </div>

                  <div>
                    {activeRun?.geometryResult?.status === 'SUCCESS' ? (
                      <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" /> ALIGNED
                      </span>
                    ) : activeRun?.geometryResult?.status === 'NO_OVERLAP' ? (
                      <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/30">
                        <XCircle className="w-3.5 h-3.5" /> NO OVERLAP
                      </span>
                    ) : activeRun?.geometryResult?.status === 'INSUFFICIENT_GEODATA' ? (
                      <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/30">
                        <AlertTriangle className="w-3.5 h-3.5" /> NO GEODATA
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-slate-500">READY</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border bg-slate-900/40 border-slate-800/80 text-slate-400 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-950 flex items-center justify-center font-mono font-bold text-xs border border-slate-800">
                    2
                  </div>
                  <div>
                    <div className="text-xs font-bold font-sans text-slate-300">
                      Multimodal / Sun-Angle Feature Matching
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      2D FFT Phase Correlation & Mutual Information Engine
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-500">PENDING STEP 1</span>
              </div>

              <div className="p-3.5 rounded-xl border bg-slate-900/40 border-slate-800/80 text-slate-400 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-950 flex items-center justify-center font-mono font-bold text-xs border border-slate-800">
                    3
                  </div>
                  <div>
                    <div className="text-xs font-bold font-sans text-slate-300">
                      Spatial Distribution & RANSAC Verification
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      Uniform Grid Control & Geometric Residual Refinement
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-500">PENDING</span>
              </div>

              <div className="p-3.5 rounded-xl border bg-slate-900/40 border-slate-800/80 text-slate-400 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-950 flex items-center justify-center font-mono font-bold text-xs border border-slate-800">
                    4
                  </div>
                  <div>
                    <div className="text-xs font-bold font-sans text-slate-300">
                      Selenographic Registration & 2D Moon Map
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      Permanent Scientific Record & Interactive Moon Viewer
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-500">PENDING</span>
              </div>
            </div>
          </div>

          {activeRun?.geometryResult && (
            <div className="p-5 rounded-2xl bg-slate-950/90 border border-cyan-500/30 shadow-[0_0_24px_rgba(6,182,212,0.15)] space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                  <Compass className="w-4 h-4 text-cyan-400" />
                  Cartographic Alignment Telemetry
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                  Overlap: {(activeRun.geometryResult.overlap_ratio * 100).toFixed(1)}%
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1">
                  <div className="text-cyan-400 font-bold text-[11px]">Image A Selenographic Bounds</div>
                  {activeRun.geometryResult.image_a_bounds ? (
                    <>
                      <div>Lat: [{activeRun.geometryResult.image_a_bounds.min_lat}°, {activeRun.geometryResult.image_a_bounds.max_lat}°]</div>
                      <div>Lon: [{activeRun.geometryResult.image_a_bounds.min_lon}°, {activeRun.geometryResult.image_a_bounds.max_lon}°]</div>
                    </>
                  ) : (
                    <div className="text-slate-500">No bounds extracted</div>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1">
                  <div className="text-purple-400 font-bold text-[11px]">Image B Selenographic Bounds</div>
                  {activeRun.geometryResult.image_b_bounds ? (
                    <>
                      <div>Lat: [{activeRun.geometryResult.image_b_bounds.min_lat}°, {activeRun.geometryResult.image_b_bounds.max_lat}°]</div>
                      <div>Lon: [{activeRun.geometryResult.image_b_bounds.min_lon}°, {activeRun.geometryResult.image_b_bounds.max_lon}°]</div>
                    </>
                  ) : (
                    <div className="text-slate-500">No bounds extracted</div>
                  )}
                </div>
              </div>

              {activeRun.geometryResult.coarse_affine_matrix && (
                <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1 text-xs font-mono">
                  <div className="text-slate-400 text-[11px] font-bold">Coarse Affine Transformation Matrix (3x3):</div>
                  <pre className="text-cyan-300 text-[11px] bg-black/50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(activeRun.geometryResult.coarse_affine_matrix, null, 2)}
                  </pre>
                </div>
              )}

              <div className="text-[11px] font-mono text-slate-400 bg-slate-900/90 p-2.5 rounded border border-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>{activeRun.geometryResult.message}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
