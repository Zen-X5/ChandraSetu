'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLoginMutation } from '@/lib/services/authApi';
import { useAppDispatch } from '@/lib/hooks/hooks';
import { setCredentials } from '@/lib/features/auth/authSlice';
import SpaceTetris from './SpaceTetris';
import { Lock, Eye, EyeOff, Radio, ShieldCheck, Orbit, ChevronRight, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useLoginMutation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWarpBoosting, setIsWarpBoosting] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const STAR_COUNT = 900;
    const stars: Array<{
      x: number;
      y: number;
      z: number;
      pz: number;
      color: string;
      size: number;
    }> = [];

    const colors = ['#ffffff', '#f8fafc', '#ffffff', '#fffbeb', '#fef9c3', '#e2e8f0'];

    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 2000,
        y: (Math.random() - 0.5) * 2000,
        z: Math.random() * 1500,
        pz: 1500,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 1.5 + 0.5,
      });
    }

    let speed = 4.5;
    let targetSpeed = 4.5;

    const render = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2 + mouseRef.current.x * 40;
      const cy = height / 2 + mouseRef.current.y * 30;

      targetSpeed = isWarpBoosting ? 28 : 4.5;
      speed += (targetSpeed - speed) * 0.08;

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        star.pz = star.z;
        star.z -= speed;

        if (star.z <= 0) {
          star.x = (Math.random() - 0.5) * 2000;
          star.y = (Math.random() - 0.5) * 2000;
          star.z = 1500;
          star.pz = 1500;
        }

        const k = 400 / star.z;
        const px = star.x * k + cx;
        const py = star.y * k + cy;

        const pk = 400 / star.pz;
        const prevPx = star.x * pk + cx;
        const prevPy = star.y * pk + cy;

        if (px >= 0 && px <= width && py >= 0 && py <= height) {
          const brightness = Math.min(1, (1 - star.z / 1500) * 1.5);
          ctx.beginPath();
          ctx.strokeStyle = star.color;
          ctx.lineWidth = star.size * (1 - star.z / 1500) * (isWarpBoosting ? 2.5 : 1.2);
          ctx.globalAlpha = brightness;
          ctx.moveTo(prevPx, prevPy);
          ctx.lineTo(px, py);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(px, py, star.size * (1 - star.z / 1500), 0, Math.PI * 2);
          ctx.fillStyle = star.color;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1.0;

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isWarpBoosting]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    mouseRef.current = { x: nx * 2, y: ny * 2 };
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('Please enter both Callsign/Email and Security Access Key.');
      return;
    }

    try {
      setIsWarpBoosting(true);
      const res = await login({ email, password }).unwrap();

      dispatch(
        setCredentials({
          user: res.user,
          token: res.access_token,
        }),
      );

      setTimeout(() => {
        router.push('/dashboard');
      }, 700);
    } catch (err: unknown) {
      setIsWarpBoosting(false);
      const errorObj = err as { data?: { message?: string }; error?: string; message?: string };
      const msg =
        errorObj?.data?.message ||
        errorObj?.error ||
        errorObj?.message ||
        'Authentication failed. Verify credentials and clearance level.';
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-black select-none text-slate-100 font-sans">
      <header className="relative z-30 h-13 border-b border-cyan-500/30 bg-black/95 backdrop-blur-md flex items-center justify-between px-4 shrink-0 shadow-[0_4px_20px_rgba(0,0,0,0.9)]">

        <div className="flex items-center gap-3 z-10 shrink-0 pr-4 bg-black py-1">
          <div className="relative flex items-center justify-center w-10 h-10 bg-black shrink-0">
            <Image
              src="/logo.png"
              alt="ChandraSetu Logo"
              width={40}
              height={40}
              priority
              className="w-full h-full object-contain drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold tracking-wider text-sm bg-gradient-to-r from-cyan-400 via-sky-200 to-amber-300 bg-clip-text text-transparent">
                CHANDRASETU
              </span>
            </div>
            <p className="text-[9px] text-slate-400 font-mono tracking-tight uppercase">
              CHANDRAYAAN-2 LUNAR IMAGE CORRESPONDENCE
            </p>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden h-full flex items-center mx-4 mask-[linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
          <div className="animate-marquee-ltr flex items-center gap-12 text-xs font-mono font-semibold tracking-wider text-cyan-300/90 whitespace-nowrap">

            <span className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>CHANDRAYAAN-2 ORBITER · SCIENCE DATA</span>
            </span>

            <span className="text-slate-500">•</span>

            <span className="text-cyan-300">
              ORBIT: ~100 KM POLAR
            </span>

            <span className="text-slate-500">•</span>

            <span className="text-amber-300/90">
              PAYLOADS: OHRC · TMC-2 · IIRS
            </span>

            <span className="text-slate-500">•</span>

            <span className="text-sky-300">
              PDS4 DATA PRODUCTS · SUPPORTED
            </span>

            <span className="text-slate-500">•</span>

            <span className="text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>REGISTRATION PIPELINE · READY</span>
            </span>

            <span className="text-slate-500">•</span>

            <span className="text-cyan-400">
              LUNAR IMAGE CORRESPONDENCE · CHANDRASETU
            </span>

            <span className="text-slate-500">•</span>

            {/* Duplicate for seamless marquee */}
            <span>CHANDRAYAAN-2 ORBITER · SCIENCE DATA</span>

            <span className="text-slate-500">•</span>

            <span className="text-cyan-300">
              ORBIT: ~100 KM POLAR
            </span>

            <span className="text-slate-500">•</span>

            <span className="text-amber-300/90">
              PAYLOADS: OHRC · TMC-2 · IIRS
            </span>

          </div>
        </div>
      </header>

      <div className="flex flex-1 w-full h-[calc(100vh-3.25rem)] overflow-hidden relative bg-black">
        <main
          className="relative flex-1 h-full flex items-center justify-center overflow-hidden cursor-crosshair bg-black"
          onMouseMove={handleMouseMove}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-auto bg-black"
          />

          <div
            className={`relative z-20 w-full max-w-[550px] mx-4 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] origin-bottom-left ${isMinimized
              ? 'opacity-0 scale-20 -translate-x-[35vw] translate-y-[35vh] pointer-events-none'
              : 'opacity-100 scale-100 translate-x-0 translate-y-0 pointer-events-auto'
              }`}
          >

            <div className="rounded-xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(14,165,233,0.3)] border border-cyan-500/40 bg-slate-900/95 backdrop-blur-xl">

              <div className="xp-titlebar px-3.5 py-2 flex items-center justify-between border-b border-[#002d80]">
                <div className="flex items-center gap-2">

                  <span className="font-sans font-bold text-xs text-white tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    Log On to ChandraSetu
                  </span>
                </div>

                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setIsMinimized(true)}
                    title="Minimize"
                    className="xp-titlebar-btn w-5 h-5 rounded-[3px] text-white flex items-center justify-center font-bold text-[11px] leading-none active:scale-95 cursor-pointer hover:brightness-110"
                  >
                    _
                  </button>
                </div>
              </div>

              <form onSubmit={handleLogin} className="p-5 sm:p-6 bg-slate-900/95 space-y-4">

                {errorMessage && (
                  <div className="p-2.5 rounded-md bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs flex items-center gap-2 animate-shake">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">

                  <div className="hidden sm:flex flex-col items-center justify-center shrink-0 w-20 pt-1">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-900 p-0.5 shadow-[0_0_15px_rgba(6,182,212,0.4)] flex items-center justify-center">
                      <div className="w-full h-full rounded-[10px] bg-slate-950/80 flex items-center justify-center">
                        <Lock className="w-8 h-8 text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 w-full space-y-3.5">

                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                      <label className="text-xs font-semibold text-slate-200 sm:w-24 shrink-0">
                        Email:
                      </label>
                      <input
                        type="email"
                        id="login-email-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="scientist@chandrasetu.isro.gov.in"
                        required
                        className="xp-input flex-1 px-3 py-1.5 rounded text-xs font-medium text-slate-900 placeholder:text-slate-400 transition-all"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                      <label className="text-xs font-semibold text-slate-200 sm:w-24 shrink-0">
                        Password:
                      </label>
                      <div className="relative flex-1">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id="login-password-input"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          required
                          className="xp-input w-full px-3 py-1.5 pr-8 rounded text-xs font-medium text-slate-900 placeholder:text-slate-400 transition-all font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          title={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={isLoading}
                    id="submit-logon-btn"
                    className="xp-button-primary min-w-[120px] py-1.5 px-6 rounded-full text-white font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Orbit className="w-3.5 h-3.5 animate-spin" />
                        <span>LOGGING IN...</span>
                      </>
                    ) : (
                      <>
                        <span>LOG IN</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>

              </form>
            </div>
          </div>

          <div
            className={`absolute bottom-6 left-6 z-30 transition-all duration-400 ease-out ${isMinimized
              ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto delay-150'
              : 'opacity-0 translate-y-6 scale-90 pointer-events-none'
              }`}
          >
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="xp-titlebar px-4 py-2 rounded-lg flex items-center gap-2.5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.9),0_0_20px_rgba(14,165,233,0.5)] border border-cyan-400/50 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              title="Click to restore logon dialog"
            >
              <span className="font-sans font-bold text-xs tracking-wide">
                Log On to ChandraSetu
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/80 border border-blue-400/40 text-cyan-200 font-mono">
                RESTORE
              </span>
            </button>
          </div>
        </main>

        <aside className="w-80 xl:w-96 h-full border-l border-cyan-500/30 bg-black flex flex-col shrink-0 relative z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.9)]">
          <SpaceTetris />
        </aside>

      </div>
    </div>
  );
}
