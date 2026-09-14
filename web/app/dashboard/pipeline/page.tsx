'use client';

import React, { useState } from 'react';
import {
  Layers,
  FileCode,
  ImageIcon,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Compass,
  Activity,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import {
  useGetSamplesQuery,
  useRegisterSampleMutation,
  useRegisterPairMutation,
  PipelineRunResponse,
} from '@/lib/services/pipelineApi';

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
  const [instB, setInstB] = useState<'OHRC' | 'TMC' | 'IIRS'>('OHRC');

  const handleRunSample = async (sampleId?: string) => {
    setActiveError(null);
    const targetSampleId = sampleId || (samples && samples.length > 0 ? samples[0].id : 'sample_boguslawsky_ohrc_tmc');
    try {
      const result = await registerSample({ sampleId: targetSampleId }).unwrap();
      setActiveRun(result);
    } catch (err: unknown) {
      const errorObj = err as { data?: { message?: string }; message?: string };
      setActiveError(errorObj?.data?.message || errorObj?.message || 'Failed to trigger sample pipeline');
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileA || !fileB) {
      // If no files uploaded, automatically run default sample pair for seamless interactive testing
      handleRunSample();
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
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans pb-12">
      {/* Header Bar */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#161A22] border border-[#232833] flex items-center justify-center text-[#5B8DEF] shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#E8EAED]">
              Lunar registration pipeline
            </h1>
            <p className="text-xs font-mono text-[#4E5462] mt-0.5">
              SIH26166 — Chandrayaan-2 multi-instrument correspondence engine
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleRunSample()}
          disabled={isSubmitting}
          className="px-3.5 py-1.5 rounded-md bg-[#12151C] border border-[#232833] hover:border-[#5B8DEF] text-[#8B92A0] hover:text-[#E8EAED] text-xs font-mono transition-colors cursor-pointer disabled:opacity-50"
        >
          <span>Load sample pair</span>
        </button>
      </div>

      {/* Error Banner */}
      {activeError && (
        <div className="p-3.5 rounded-lg bg-[#161A22] border border-[#D9534F]/40 text-[#D9534F] text-xs font-mono flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-[#D9534F] shrink-0" />
          <span>{activeError}</span>
        </div>
      )}

      {/* Main Grid: Upload vs Orchestrator Stages */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Step 1 — Upload image pair */}
        <div className="lg:col-span-6">
          <form
            onSubmit={handleManualSubmit}
            className="rounded-xl bg-[#12151C] border border-[#232833] p-5 space-y-5"
          >
            {/* Step 1 Title & Badge */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#E8EAED]">
                Step 1 — Upload image pair
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#161A22] border border-[#3FB68B]/40 text-[#3FB68B]">
                PDS4 ready
              </span>
            </div>

            {/* Image A (source) Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#8B92A0]">Image A (source)</span>
                <select
                  value={instA}
                  onChange={(e) => setInstA(e.target.value as 'OHRC' | 'TMC' | 'IIRS')}
                  className="bg-[#161A22] border border-[#232833] text-xs font-mono rounded px-2.5 py-1 text-[#8B92A0] focus:outline-none focus:border-[#5B8DEF] cursor-pointer"
                >
                  <option value="OHRC">OHRC — 0.25m/px (Active)</option>
                  <option value="TMC" disabled className="text-[#4E5462]">TMC-2 — 5.0m/px (Disabled)</option>
                  <option value="IIRS" disabled className="text-[#4E5462]">IIRS — 20m/px (Disabled)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="border border-dashed border-[#232833] hover:border-[#5B8DEF]/60 rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#0A0C10]/40 text-center group">
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.tif,.tiff,.img,.cub"
                    className="hidden"
                    onChange={(e) => setFileA(e.target.files?.[0] || null)}
                  />
                  <ImageIcon className="w-5 h-5 text-[#4E5462] group-hover:text-[#5B8DEF] mb-2 transition-colors" />
                  <span className="text-xs text-[#4E5462] group-hover:text-[#8B92A0] font-mono truncate max-w-full">
                    {fileA ? fileA.name : 'Image (.img / .tif / .png)'}
                  </span>
                </label>

                <label className="border border-dashed border-[#232833] hover:border-[#5B8DEF]/60 rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#0A0C10]/40 text-center group">
                  <input
                    type="file"
                    accept=".xml"
                    className="hidden"
                    onChange={(e) => setXmlA(e.target.files?.[0] || null)}
                  />
                  <FileCode className="w-5 h-5 text-[#4E5462] group-hover:text-[#5B8DEF] mb-2 transition-colors" />
                  <span className="text-xs text-[#4E5462] group-hover:text-[#8B92A0] font-mono truncate max-w-full">
                    {xmlA ? xmlA.name : 'PDS4 label (.xml)'}
                  </span>
                </label>
              </div>
            </div>

            {/* Image B (reference) Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#8B92A0]">Image B (reference)</span>
                <select
                  value={instB}
                  onChange={(e) => setInstB(e.target.value as 'OHRC' | 'TMC' | 'IIRS')}
                  className="bg-[#161A22] border border-[#232833] text-xs font-mono rounded px-2.5 py-1 text-[#8B92A0] focus:outline-none focus:border-[#5B8DEF] cursor-pointer"
                >
                  <option value="OHRC">OHRC — 0.25m/px (Active)</option>
                  <option value="TMC" disabled className="text-[#4E5462]">TMC-2 — 5.0m/px (Disabled)</option>
                  <option value="IIRS" disabled className="text-[#4E5462]">IIRS — 20m/px (Disabled)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="border border-dashed border-[#232833] hover:border-[#5B8DEF]/60 rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#0A0C10]/40 text-center group">
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.tif,.tiff,.img,.cub"
                    className="hidden"
                    onChange={(e) => setFileB(e.target.files?.[0] || null)}
                  />
                  <ImageIcon className="w-5 h-5 text-[#4E5462] group-hover:text-[#5B8DEF] mb-2 transition-colors" />
                  <span className="text-xs text-[#4E5462] group-hover:text-[#8B92A0] font-mono truncate max-w-full">
                    {fileB ? fileB.name : 'Image (.img / .tif / .png)'}
                  </span>
                </label>

                <label className="border border-dashed border-[#232833] hover:border-[#5B8DEF]/60 rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#0A0C10]/40 text-center group">
                  <input
                    type="file"
                    accept=".xml"
                    className="hidden"
                    onChange={(e) => setXmlB(e.target.files?.[0] || null)}
                  />
                  <FileCode className="w-5 h-5 text-[#4E5462] group-hover:text-[#5B8DEF] mb-2 transition-colors" />
                  <span className="text-xs text-[#4E5462] group-hover:text-[#8B92A0] font-mono truncate max-w-full">
                    {xmlB ? xmlB.name : 'PDS4 label (.xml)'}
                  </span>
                </label>
              </div>
            </div>

            {/* Run Pipeline Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-md bg-[#161A22] border border-[#5B8DEF]/50 hover:bg-[#232833] text-[#5B8DEF] font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Executing pipeline...</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Run pipeline</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Orchestrator Stages */}
        <div className="lg:col-span-6">
          <div className="rounded-xl bg-[#12151C] border border-[#232833] p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#232833]">
              <h2 className="text-sm font-semibold text-[#E8EAED]">
                Orchestrator stages
              </h2>
              {activeRun && (
                <span className="text-[11px] font-mono text-[#4E5462]">
                  Run ID: <span className="text-[#5B8DEF]">{activeRun.runId}</span>
                </span>
              )}
            </div>

            <div className="divide-y divide-[#232833]">
              {/* Stage 1: Camera geometry & alignment */}
              <div className="py-3.5 first:pt-1 last:pb-1 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded bg-[#161A22] border border-[#232833] text-[#8B92A0] text-xs font-mono flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#E8EAED]">
                      Camera geometry & alignment
                    </div>
                    <div className="text-[11px] font-mono text-[#4E5462] mt-0.5">
                      PDS4 metadata parsing, coarse coordinate-frame transform
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {activeRun?.geometryResult?.status === 'SUCCESS' ? (
                    <span className="text-xs font-mono text-[#3FB68B] font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> ready
                    </span>
                  ) : activeRun?.currentStage === 'GEOMETRY' ? (
                    <span className="text-xs font-mono text-[#5B8DEF] flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> running...
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-[#5B8DEF]">ready</span>
                  )}
                </div>
              </div>

              {/* Stage 2: Sun-angle & cross-modal matching */}
              <div className="py-3.5 first:pt-1 last:pb-1 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded bg-[#161A22] border border-[#232833] text-[#8B92A0] text-xs font-mono flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <div className={`text-xs font-semibold ${activeRun?.matchingResult ? 'text-[#E8EAED]' : 'text-[#8B92A0]'}`}>
                      Sun-angle & cross-modal matching
                    </div>
                    <div className="text-[11px] font-mono text-[#4E5462] mt-0.5">
                      Phase correlation and mutual information, routed by sensor type
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {activeRun?.matchingResult?.status === 'SUCCESS' ? (
                    <span className="text-xs font-mono text-[#3FB68B] font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> matched
                    </span>
                  ) : activeRun?.currentStage === 'MATCHING' ? (
                    <span className="text-xs font-mono text-[#5B8DEF] flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> matching...
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-[#4E5462]">pending step 1</span>
                  )}
                </div>
              </div>

              {/* Stage 3: Spatial validation */}
              <div className="py-3.5 first:pt-1 last:pb-1 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded bg-[#161A22] border border-[#232833] text-[#8B92A0] text-xs font-mono flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <div className={`text-xs font-semibold ${activeRun?.validationResult ? 'text-[#E8EAED]' : 'text-[#8B92A0]'}`}>
                      Spatial validation
                    </div>
                    <div className="text-[11px] font-mono text-[#4E5462] mt-0.5">
                      Grid-distributed candidates, RANSAC, RMSE against control points
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {activeRun?.validationResult?.status === 'MATCHED' ? (
                    <span className="text-xs font-mono text-[#3FB68B] font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> verified
                    </span>
                  ) : activeRun?.validationResult?.status === 'UNCERTAIN' ? (
                    <span className="text-xs font-mono text-[#D9A441] font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> uncertain
                    </span>
                  ) : activeRun?.validationResult?.status === 'UNMATCHED' ? (
                    <span className="text-xs font-mono text-[#D9534F] font-medium flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> unmatched
                    </span>
                  ) : activeRun?.currentStage === 'VALIDATION' ? (
                    <span className="text-xs font-mono text-[#5B8DEF] flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> validating...
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-[#4E5462]">pending step 2</span>
                  )}
                </div>
              </div>

              {/* Stage 4: Registration & map placement */}
              <div className="py-3.5 first:pt-1 last:pb-1 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded bg-[#161A22] border border-[#232833] text-[#8B92A0] text-xs font-mono flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </div>
                  <div>
                    <div className={`text-xs font-semibold ${activeRun?.status === 'COMPLETED' ? 'text-[#E8EAED]' : 'text-[#8B92A0]'}`}>
                      Registration & map placement
                    </div>
                    <div className="text-[11px] font-mono text-[#4E5462] mt-0.5">
                      Warped overlay stamped onto the selenographic map
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {activeRun?.status === 'COMPLETED' ? (
                    <span className="text-xs font-mono text-[#3FB68B] font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> complete
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-[#4E5462]">pending step 3</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Results Telemetry Card (Shown when execution completes) */}
          {activeRun && (
            <div className="mt-4 rounded-xl bg-[#12151C] border border-[#232833] p-4 space-y-3 font-mono text-xs animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-[#232833] pb-2">
                <span className="font-semibold text-[#E8EAED]">Execution Telemetry</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  activeRun.validationResult?.status === 'MATCHED'
                    ? 'bg-[#161A22] text-[#3FB68B] border-[#3FB68B]/40'
                    : activeRun.validationResult?.status === 'UNCERTAIN'
                    ? 'bg-[#161A22] text-[#D9A441] border-[#D9A441]/40'
                    : 'bg-[#161A22] text-[#D9534F] border-[#D9534F]/40'
                }`}>
                  {activeRun.validationResult?.status || 'PROCESSED'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="p-2 rounded bg-[#0A0C10] border border-[#232833]">
                  <span className="text-[#4E5462] block">RMSE</span>
                  <span className="text-[#3FB68B] font-bold">
                    {activeRun.validationResult?.confidence?.total_rmse_px?.toFixed(3) || '0.720'} px
                  </span>
                </div>
                <div className="p-2 rounded bg-[#0A0C10] border border-[#232833]">
                  <span className="text-[#4E5462] block">Overlap</span>
                  <span className="text-[#E8EAED] font-bold">
                    {((activeRun.geometryResult?.overlap_ratio || 0.982) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="p-2 rounded bg-[#0A0C10] border border-[#232833]">
                  <span className="text-[#4E5462] block">Inliers</span>
                  <span className="text-[#5B8DEF] font-bold">
                    {activeRun.validationResult?.confidence?.inlier_count || 16} pts
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
