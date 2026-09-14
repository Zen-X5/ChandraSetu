'use client';

import React from 'react';
import Link from 'next/link';

interface ActivityLog {
  id: string;
  time: string;
  runId: string;
  message: string;
  highlightType?: 'plain' | 'accent' | 'ok' | 'error';
}

const INITIAL_LOGS: ActivityLog[] = [
  { id: '1', time: '14:22:03', runId: 'run_2f9a', message: 'geometry stage complete — 0.9s', highlightType: 'plain' },
  { id: '2', time: '14:22:04', runId: 'run_2f9a', message: 'routed to phase_correlation (OHRC+TMC-2)', highlightType: 'accent' },
  { id: '3', time: '14:22:11', runId: 'run_2f9a', message: 'validation — 47/63 inliers, rmse 0.72px', highlightType: 'plain' },
  { id: '4', time: '14:22:11', runId: 'run_2f9a', message: '→ MATCHED, registered on map', highlightType: 'ok' },
  { id: '5', time: '14:21:47', runId: 'run_2f88', message: 'geometry stage complete — 1.1s', highlightType: 'plain' },
  { id: '6', time: '14:21:52', runId: 'run_2f88', message: 'routed to mutual_information (OHRC+IIRS)', highlightType: 'accent' },
  { id: '7', time: '14:22:01', runId: 'run_2f88', message: 'validation — 9/58 inliers, rmse 2.14px', highlightType: 'plain' },
  { id: '8', time: '14:22:01', runId: 'run_2f88', message: '→ UNMATCHED, no correspondence found', highlightType: 'error' },
];

interface RecentObservation {
  id: string;
  pair: string;
  status: 'matched' | 'unmatched' | 'uncertain';
  confidence: number;
  rmse: string;
  recorded: string;
}

const RECENT_OBSERVATIONS: RecentObservation[] = [
  { id: 'obs_9f21', pair: 'OHRC ↔ TMC-2', status: 'matched', confidence: 0.91, rmse: '0.72 px', recorded: '14:22:11' },
  { id: 'obs_9f20', pair: 'OHRC ↔ IIRS', status: 'unmatched', confidence: 0.14, rmse: '2.14 px', recorded: '14:22:01' },
  { id: 'obs_9f19', pair: 'OHRC ↔ OHRC', status: 'uncertain', confidence: 0.52, rmse: '1.38 px', recorded: '14:20:52' },
  { id: 'obs_9f18', pair: 'TMC-2 ↔ IIRS', status: 'matched', confidence: 0.88, rmse: '0.65 px', recorded: '14:18:30' },
  { id: 'obs_9f17', pair: 'OHRC ↔ TMC-2', status: 'matched', confidence: 0.95, rmse: '0.54 px', recorded: '14:15:10' },
];

export default function DashboardHomePage() {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto font-sans">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-[#E8EAED] tracking-tight font-sans">
          Mission control home
        </h1>
      </div>

      {/* Metric Stats Banner (Panel #12151C, border #232833) */}
      <div className="rounded-xl bg-[#12151C] border border-[#232833] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-[#232833] overflow-hidden shadow-sm">
        {/* Metric 1 */}
        <div className="p-5">
          <div className="text-[10px] font-mono font-bold tracking-wider text-[#4E5462] uppercase">
            OBSERVATIONS
          </div>
          <div className="text-3xl font-bold text-[#E8EAED] mt-1.5 font-sans tracking-tight">
            128
          </div>
          <div className="text-[11px] text-[#4E5462] mt-1 font-mono">
            +6 today
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5">
          <div className="text-[10px] font-mono font-bold tracking-wider text-[#4E5462] uppercase">
            MATCHED
          </div>
          <div className="text-3xl font-bold text-[#3FB68B] mt-1.5 font-sans tracking-tight">
            94
          </div>
          <div className="text-[11px] text-[#4E5462] mt-1 font-mono">
            73.4% of total
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5">
          <div className="text-[10px] font-mono font-bold tracking-wider text-[#4E5462] uppercase">
            UNCERTAIN
          </div>
          <div className="text-3xl font-bold text-[#D9A441] mt-1.5 font-sans tracking-tight">
            11
          </div>
          <div className="text-[11px] text-[#4E5462] mt-1 font-mono">
            needs review
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5">
          <div className="text-[10px] font-mono font-bold tracking-wider text-[#4E5462] uppercase">
            QUEUE DEPTH
          </div>
          <div className="text-3xl font-bold text-[#E8EAED] mt-1.5 font-sans tracking-tight">
            3
          </div>
          <div className="text-[11px] text-[#4E5462] mt-1 font-mono">
            avg wait 41s
          </div>
        </div>

        {/* Metric 5 */}
        <div className="p-5">
          <div className="text-[10px] font-mono font-bold tracking-wider text-[#4E5462] uppercase">
            MEAN RMSE
          </div>
          <div className="text-3xl font-bold text-[#E8EAED] mt-1.5 font-sans tracking-tight">
            0.81 <span className="text-base font-normal text-[#8B92A0]">px</span>
          </div>
          <div className="text-[11px] text-[#4E5462] mt-1 font-mono">
            last 24h
          </div>
        </div>
      </div>

      {/* Middle Grid: Pipeline Activity & 14 Days Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Pipeline Activity */}
        <div className="lg:col-span-7 rounded-xl bg-[#12151C] border border-[#232833] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3">
            <h2 className="text-sm font-semibold text-[#E8EAED]">
              Pipeline activity
            </h2>
            <span className="text-xs font-mono text-[#4E5462]">
              live
            </span>
          </div>

          <div className="mc-terminal rounded-lg p-4 h-64 overflow-y-auto space-y-2 text-[11px] leading-relaxed bg-[#0A0C10] border border-[#232833]">
            {INITIAL_LOGS.map((log) => (
              <div key={log.id} className="flex items-start gap-2.5 font-mono">
                <span className="text-[#4E5462] shrink-0">{log.time}</span>
                <span className="text-[#E8EAED] font-bold shrink-0">{log.runId}</span>
                <span
                  className={
                    log.highlightType === 'ok'
                      ? 'text-[#3FB68B] font-medium'
                      : log.highlightType === 'error'
                      ? 'text-[#D9534F] font-medium'
                      : log.highlightType === 'accent'
                      ? 'text-[#5B8DEF]'
                      : 'text-[#8B92A0]'
                  }
                >
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Observations, last 14 days */}
        <div className="lg:col-span-5 rounded-xl bg-[#12151C] border border-[#232833] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3">
            <h2 className="text-sm font-semibold text-[#E8EAED]">
              Observations, last 14 days
            </h2>
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-[#3FB68B] inline-block" />
                <span className="text-[#8B92A0] text-[11px]">Matched</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-[#D9534F] inline-block" />
                <span className="text-[#8B92A0] text-[11px]">Unmatched</span>
              </div>
            </div>
          </div>

          {/* 14-Day Graph SVG */}
          <div className="h-64 w-full flex flex-col justify-end pt-2">
            <div className="relative w-full h-48">
              <svg viewBox="0 0 520 180" className="w-full h-full overflow-visible">
                {/* Grid Lines (Border #232833) */}
                {[0, 36, 72, 108, 144, 180].map((y, i) => (
                  <g key={i}>
                    <line x1="28" y1={y} x2="520" y2={y} stroke="#232833" strokeWidth="1" />
                    <text x="0" y={y + 4} fill="#4E5462" fontSize="10" fontFamily="monospace">
                      {10 - i * 2}
                    </text>
                  </g>
                ))}

                {/* Matched Spline Line (Green #3FB68B) */}
                <path
                  d="M 35 125 C 65 110, 80 135, 110 140 C 140 120, 160 100, 190 105 C 220 130, 245 90, 275 80 C 305 105, 325 70, 355 60 C 385 85, 410 65, 440 45 C 470 70, 490 35, 515 45"
                  fill="none"
                  stroke="#3FB68B"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />

                {/* Unmatched Spline Line (Red #D9534F) */}
                <path
                  d="M 35 145 C 65 145, 80 142, 110 148 C 140 130, 160 140, 190 155 C 220 140, 245 155, 275 150 C 305 158, 325 152, 355 155 C 385 150, 410 145, 440 140 C 470 155, 490 150, 515 152"
                  fill="none"
                  stroke="#D9534F"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* X-Axis Date Labels */}
            <div className="flex justify-between text-[9px] font-mono text-[#4E5462] pt-2 border-t border-[#232833] px-2">
              <span>D-13</span>
              <span>D-12</span>
              <span>D-11</span>
              <span>D-10</span>
              <span>D-9</span>
              <span>D-8</span>
              <span>D-7</span>
              <span>D-6</span>
              <span>D-5</span>
              <span>D-4</span>
              <span>D-3</span>
              <span>D-2</span>
              <span>D-1</span>
              <span>Today</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Card: Recent Observations Table */}
      <div className="rounded-xl bg-[#12151C] border border-[#232833] p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4">
          <h2 className="text-sm font-semibold text-[#E8EAED]">
            Recent observations
          </h2>
          <span className="text-xs font-mono text-[#4E5462]">
            showing 5 of 120
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#232833] text-[10px] font-mono text-[#4E5462] uppercase tracking-wider">
                <th className="pb-3 font-semibold">OBSERVATION</th>
                <th className="pb-3 font-semibold">PAIR</th>
                <th className="pb-3 font-semibold">STATUS</th>
                <th className="pb-3 font-semibold">CONFIDENCE</th>
                <th className="pb-3 font-semibold">RMSE</th>
                <th className="pb-3 font-semibold">RECORDED</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232833] text-xs font-mono">
              {RECENT_OBSERVATIONS.map((obs) => (
                <tr key={obs.id} className="hover:bg-[#161A22] transition-colors">
                  <td className="py-3.5 text-[#E8EAED] font-medium">
                    <Link
                      href="/dashboard/observations"
                      className="hover:text-[#5B8DEF] transition-colors"
                    >
                      {obs.id}
                    </Link>
                  </td>
                  <td className="py-3.5 text-[#8B92A0]">{obs.pair}</td>
                  <td className="py-3.5">
                    {obs.status === 'matched' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-[#161A22] text-[#3FB68B] border border-[#3FB68B]/40">
                        <span className="w-1.5 h-1.5 rounded-sm bg-[#3FB68B]" />
                        matched
                      </span>
                    )}
                    {obs.status === 'unmatched' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-[#161A22] text-[#D9534F] border border-[#D9534F]/40">
                        <span className="w-1.5 h-1.5 rounded-sm bg-[#D9534F]" />
                        unmatched
                      </span>
                    )}
                    {obs.status === 'uncertain' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-[#161A22] text-[#D9A441] border border-[#D9A441]/40">
                        <span className="w-1.5 h-1.5 rounded-sm bg-[#D9A441]" />
                        uncertain
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 text-[#8B92A0]">{obs.confidence.toFixed(2)}</td>
                  <td className="py-3.5 text-[#8B92A0]">{obs.rmse}</td>
                  <td className="py-3.5 text-[#4E5462]">{obs.recorded}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
