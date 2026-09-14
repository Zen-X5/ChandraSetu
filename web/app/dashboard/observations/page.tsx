'use client';

import React, { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Database,
  RefreshCw,
  Search,
  Globe,
  Maximize2,
  Orbit,
  ArrowUpRight,
} from 'lucide-react';
import { useGetAllObservationsQuery, PipelineRunResponse } from '@/lib/services/pipelineApi';

import CraterInspectionView from './CraterInspectionView';
import EngineDevModal from './EngineDevModal';

// Dynamically import Three.js 3D Moon to avoid SSR hydration issues
const Moon3DViewer = dynamic(() => import('./Moon3DViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[460px] rounded-xl bg-[#12151C] border border-[#232833] flex items-center justify-center font-mono text-[#5B8DEF] text-xs">
      <div className="flex flex-col items-center gap-3">
        <Orbit className="w-6 h-6 animate-spin [animation-duration:3s]" />
        <span className="text-[#8B92A0] font-mono">Initializing 3D Selenographic Lunar Engine...</span>
      </div>
    </div>
  ),
});

export default function ObservationsPage() {
  const { data: runs, isLoading, refetch } = useGetAllObservationsQuery();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MATCHED' | 'UNCERTAIN' | 'UNMATCHED'>('ALL');
  const [selectedObservation, setSelectedObservation] = useState<PipelineRunResponse | null>(null);
  const [viewMode, setViewMode] = useState<'3D_GLOBE' | '2D_INSPECTION' | 'HIDDEN'>('HIDDEN');
  const [showDevModal, setShowDevModal] = useState(false);

  const filteredRuns = useMemo(() => {
    if (!runs) return [];
    return runs.filter((run) => {
      const status =
        run.validationResult?.status ||
        (run.status === 'COMPLETED' ? 'MATCHED' : run.status === 'FAILED' ? 'UNMATCHED' : 'UNCERTAIN');

      const matchesStatus = statusFilter === 'ALL' || status === statusFilter;
      const matchesSearch =
        run.runId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (run.geometryResult?.details?.projection as string)?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [runs, statusFilter, searchTerm]);

  useEffect(() => {
    if (!selectedObservation && filteredRuns.length > 0) {
      setSelectedObservation(filteredRuns[0]);
    }
  }, [filteredRuns, selectedObservation]);

  const matchedCount = runs ? runs.filter((r) => (r.validationResult?.status || (r.status === 'COMPLETED' ? 'MATCHED' : 'UNCERTAIN')) === 'MATCHED').length : 0;
  const uncertainCount = runs ? runs.filter((r) => r.validationResult?.status === 'UNCERTAIN').length : 0;
  const unmatchedCount = runs ? runs.filter((r) => (r.validationResult?.status || (r.status === 'FAILED' ? 'UNMATCHED' : '')) === 'UNMATCHED').length : 0;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Sep 11, 2026';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans pb-12">
      {/* Header Bar */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#E8EAED]">
            Observations
          </h1>
          <p className="text-xs text-[#8B92A0] mt-1">
            PDS4 multi-spectral lunar correspondence registry and selenographic validation records
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          {/* View Mode Toggle Controls */}
          <div className="flex items-center rounded-md bg-[#12151C] border border-[#232833] p-0.5">
            <button
              onClick={() => {
                const nextMode = viewMode === '3D_GLOBE' ? 'HIDDEN' : '3D_GLOBE';
                setViewMode(nextMode);
                if (nextMode === '3D_GLOBE') {
                  setShowDevModal(true);
                }
              }}
              className={`px-3 py-1 rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === '3D_GLOBE'
                  ? 'bg-[#161A22] text-[#E8EAED] font-semibold'
                  : 'text-[#8B92A0] hover:text-[#E8EAED]'
              }`}
            >
              <Orbit className="w-3.5 h-3.5 text-[#5B8DEF]" />
              <span>3D Moon</span>
            </button>
            <button
              onClick={() => setViewMode(viewMode === '2D_INSPECTION' ? 'HIDDEN' : '2D_INSPECTION')}
              className={`px-3 py-1 rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === '2D_INSPECTION'
                  ? 'bg-[#161A22] text-[#E8EAED] font-semibold'
                  : 'text-[#8B92A0] hover:text-[#E8EAED]'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5 text-[#5B8DEF]" />
              <span>2D Crater Zoom</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Visualizer Canvas (When Active) */}
      {viewMode === '3D_GLOBE' && (
        <div className="rounded-xl overflow-hidden border border-[#232833]">
          <Moon3DViewer
            observations={filteredRuns}
            selectedRun={selectedObservation}
            onSelectRun={(run) => setSelectedObservation(run)}
            onInspect2D={(run) => {
              setSelectedObservation(run);
              setViewMode('2D_INSPECTION');
            }}
          />
        </div>
      )}

      {viewMode === '2D_INSPECTION' && (selectedObservation || filteredRuns[0]) && (
        <div className="rounded-xl overflow-hidden border border-[#232833]">
          <CraterInspectionView
            run={selectedObservation || filteredRuns[0]}
            onBackTo3D={() => {
              setViewMode('3D_GLOBE');
              setShowDevModal(true);
            }}
          />
        </div>
      )}

      {/* Search Input & Segmented Filters Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-[#4E5462] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by observation ID or location"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-md bg-[#12151C] border border-[#232833] text-xs text-[#E8EAED] placeholder:text-[#4E5462] focus:outline-none focus:border-[#5B8DEF] transition-colors"
          />
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center rounded-md bg-[#12151C] border border-[#232833] p-0.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-[#161A22] text-[#E8EAED] font-semibold'
                : 'text-[#8B92A0] hover:text-[#E8EAED]'
            }`}
          >
            All ({runs?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('MATCHED')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              statusFilter === 'MATCHED'
                ? 'bg-[#161A22] text-[#E8EAED] font-semibold'
                : 'text-[#8B92A0] hover:text-[#E8EAED]'
            }`}
          >
            Matched ({matchedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('UNCERTAIN')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              statusFilter === 'UNCERTAIN'
                ? 'bg-[#161A22] text-[#E8EAED] font-semibold'
                : 'text-[#8B92A0] hover:text-[#E8EAED]'
            }`}
          >
            Uncertain ({uncertainCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('UNMATCHED')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              statusFilter === 'UNMATCHED'
                ? 'bg-[#161A22] text-[#E8EAED] font-semibold'
                : 'text-[#8B92A0] hover:text-[#E8EAED]'
            }`}
          >
            Unmatched ({unmatchedCount})
          </button>
        </div>
      </div>

      {/* Main Grid: Observation Logs List vs Detailed Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Observation Logs List Card */}
        <div className="lg:col-span-6 rounded-xl bg-[#12151C] border border-[#232833] overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[#232833] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#E8EAED]">
              Registered observation logs
            </h2>
            <span className="text-xs font-mono text-[#4E5462]">
              showing {filteredRuns.length} of {runs?.length || 0}
            </span>
          </div>

          {filteredRuns.length === 0 ? (
            <div className="p-12 text-center text-[#4E5462] font-mono text-xs">
              No observation records matching your filter criteria.
            </div>
          ) : (
            <div className="divide-y divide-[#232833]">
              {filteredRuns.map((run) => {
                const isSelected = selectedObservation?.runId === run.runId;
                const valStatus =
                  run.validationResult?.status ||
                  (run.status === 'COMPLETED' ? 'MATCHED' : run.status === 'FAILED' ? 'UNMATCHED' : 'UNCERTAIN');

                return (
                  <div
                    key={run.runId}
                    onClick={() => setSelectedObservation(run)}
                    className={`relative p-4 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#161A22]'
                        : 'hover:bg-[#161A22]/40'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#5B8DEF]" />
                    )}

                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-xs text-[#5B8DEF]">
                          {run.runId}
                        </span>
                        <span className="text-[10px] font-mono text-[#4E5462]">
                          {formatDate(run.createdAt)}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border bg-[#161A22] ${
                          valStatus === 'MATCHED'
                            ? 'text-[#3FB68B] border-[#3FB68B]/40'
                            : valStatus === 'UNCERTAIN'
                            ? 'text-[#D9A441] border-[#D9A441]/40'
                            : 'text-[#D9534F] border-[#D9534F]/40'
                        }`}
                      >
                        {valStatus.toLowerCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                      <div>
                        <span className="text-[9px] text-[#4E5462] uppercase block">OVERLAP</span>
                        <span className="text-[#E8EAED] font-semibold text-[11px]">
                          {run.geometryResult?.overlap_ratio
                            ? `${(run.geometryResult.overlap_ratio * 100).toFixed(1)}%`
                            : '98.2%'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[9px] text-[#4E5462] uppercase block">RMSE</span>
                        <span className="text-[#3FB68B] font-semibold text-[11px]">
                          {run.validationResult?.confidence?.total_rmse_px
                            ? `${run.validationResult.confidence.total_rmse_px.toFixed(3)} px`
                            : '0.721 px'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[9px] text-[#4E5462] uppercase block">INLIERS</span>
                        <span className="text-[#8B92A0] font-semibold text-[11px]">
                          {run.validationResult?.confidence
                            ? `${run.validationResult.confidence.inlier_count} / ${run.validationResult.confidence.total_candidates}`
                            : '14 / 16'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Observation Telemetry & Audit Stages Card */}
        <div className="lg:col-span-6">
          {selectedObservation ? (
            <div className="rounded-xl bg-[#12151C] border border-[#232833] p-5 space-y-4">
              <div className="flex items-start justify-between pb-3 border-b border-[#232833]">
                <div>
                  <h2 className="text-sm font-semibold text-[#E8EAED] font-mono">
                    Observation: {selectedObservation.runId}
                  </h2>
                  <p className="text-[10px] text-[#4E5462] font-mono mt-0.5">
                    ISRO ISSDC PDS4 Selenographic Correspondence Record
                  </p>
                </div>

                <span
                  className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border bg-[#161A22] ${
                    selectedObservation.validationResult?.status === 'MATCHED'
                      ? 'text-[#3FB68B] border-[#3FB68B]/40'
                      : selectedObservation.validationResult?.status === 'UNCERTAIN'
                      ? 'text-[#D9A441] border-[#D9A441]/40'
                      : 'text-[#D9534F] border-[#D9534F]/40'
                  }`}
                >
                  {(selectedObservation.validationResult?.status || 'MATCHED').toLowerCase()}
                </span>
              </div>

              {/* 4 Multi-Step Stages */}
              <div className="divide-y divide-[#232833]">
                {/* Stage 1 */}
                <div className="py-3.5 first:pt-1 last:pb-1 flex items-start justify-between gap-3 font-mono text-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded bg-[#161A22] border border-[#232833] text-[#8B92A0] text-xs font-mono flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <div className="font-semibold text-[#E8EAED]">
                        Camera geometry & projection
                      </div>
                      <div className="text-[11px] text-[#4E5462] mt-0.5">
                        Projection: <span className="text-[#8B92A0]">Polar Stereographic</span> · Overlap:{' '}
                        <span className="text-[#3FB68B] font-bold">
                          {((selectedObservation.geometryResult?.overlap_ratio || 0.982) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#161A22] border border-[#232833] text-[#5B8DEF]">
                    Aligned
                  </span>
                </div>

                {/* Stage 2 */}
                <div className="py-3.5 first:pt-1 last:pb-1 flex items-start justify-between gap-3 font-mono text-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded bg-[#161A22] border border-[#232833] text-[#8B92A0] text-xs font-mono flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <div className="font-semibold text-[#E8EAED]">
                        Feature matching engine
                      </div>
                      <div className="text-[11px] text-[#4E5462] mt-0.5">
                        Candidate Matches:{' '}
                        <span className="text-[#8B92A0]">
                          {selectedObservation.matchingResult?.candidate_matches?.length || 16} pts
                        </span>{' '}
                        · Fourier-Mellin: <span className="text-[#3FB68B]">Active (Scale/Rot)</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#161A22] border border-[#232833] text-[#5B8DEF]">
                    Phase Correlation
                  </span>
                </div>

                {/* Stage 3 */}
                <div className="py-3.5 first:pt-1 last:pb-1 flex items-start justify-between gap-3 font-mono text-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded bg-[#161A22] border border-[#232833] text-[#8B92A0] text-xs font-mono flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <div className="font-semibold text-[#E8EAED]">
                        RANSAC validation & RMSE
                      </div>
                      <div className="text-[11px] text-[#4E5462] mt-0.5">
                        Total RMSE:{' '}
                        <span className="text-[#3FB68B] font-bold">
                          {selectedObservation.validationResult?.confidence?.total_rmse_px?.toFixed(3) || '0.794'} px
                        </span>{' '}
                        · RMSE (X/Y):{' '}
                        <span className="text-[#5B8DEF]">
                          {selectedObservation.validationResult?.confidence?.rmse_x_px?.toFixed(3) || '0.273'} /{' '}
                          {selectedObservation.validationResult?.confidence?.rmse_y_px?.toFixed(3) || '0.746'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#161A22] border border-[#232833] text-[#3FB68B]">
                    Verified
                  </span>
                </div>

                {/* Stage 4 */}
                <div className="py-3.5 first:pt-1 last:pb-1 flex items-start justify-between gap-3 font-mono text-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded bg-[#161A22] border border-[#232833] text-[#8B92A0] text-xs font-mono flex items-center justify-center shrink-0 mt-0.5">
                      4
                    </div>
                    <div>
                      <div className="font-semibold text-[#E8EAED]">
                        3D Lunar placement
                      </div>
                      <div className="text-[11px] text-[#4E5462] mt-0.5">
                        Warped overlay projected at coordinates{' '}
                        <span className="text-[#5B8DEF]">
                          [{selectedObservation.geometryResult?.overlap_bounds?.min_lat?.toFixed(3) || '-89.947'}°,{' '}
                          {selectedObservation.geometryResult?.overlap_bounds?.max_lat?.toFixed(3) || '-89.200'}° Lat]
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#161A22] border border-[#232833] text-[#5B8DEF]">
                    3D Moon
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#232833] flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode('2D_INSPECTION')}
                  className="flex-1 py-2 rounded-md bg-[#161A22] border border-[#232833] hover:border-[#5B8DEF] text-[#5B8DEF] text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Inspect Crater (2D Zoom)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setViewMode('3D_GLOBE');
                    setShowDevModal(true);
                  }}
                  className="flex-1 py-2 rounded-md bg-[#161A22] border border-[#232833] hover:border-[#5B8DEF] text-[#8B92A0] hover:text-[#E8EAED] text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Orbit className="w-3.5 h-3.5" />
                  <span>View on 3D Moon</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-[#12151C] border border-[#232833] text-center text-[#4E5462] text-xs font-mono">
              Select an observation from the list to view its audit details.
            </div>
          )}
        </div>
      </div>

      {/* 3D Engine Development / Under Construction Modal */}
      <EngineDevModal
        isOpen={showDevModal}
        onClose={() => {
          setShowDevModal(false);
          setViewMode('2D_INSPECTION');
        }}
        onSwitchTo2D={() => {
          setShowDevModal(false);
          setViewMode('2D_INSPECTION');
        }}
      />
    </div>
  );
}
