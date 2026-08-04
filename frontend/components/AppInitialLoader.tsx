"use client";

import { useEffect, useState } from "react";

export function AppInitialLoader({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Check if initial loader has already been shown during this session
    if (typeof window !== "undefined") {
      const hasLoaded = sessionStorage.getItem("flumenx_initial_loaded");
      if (hasLoaded) {
        setLoading(false);
        return;
      }

      // Show branded "F" animation for genuine initial application load
      const timer = setTimeout(() => {
        setFadeOut(true);
        const exitTimer = setTimeout(() => {
          sessionStorage.setItem("flumenx_initial_loaded", "true");
          setLoading(false);
        }, 400); // match transition duration
        return () => clearTimeout(exitTimer);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, []);

  if (!loading) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-[99999] bg-[#020806] flex flex-col items-center justify-center transition-opacity duration-400 select-none ${
          fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        aria-label="Loading Flumenx Employee Portal"
      >
        {/* Ambient Radial Neon Glow */}
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(77,255,160,0.15)_0%,transparent_70%)] animate-pulse pointer-events-none" />

        {/* Animated F Mark Container */}
        <div className="relative flex flex-col items-center gap-6">
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* Outer Glowing Neon Ring */}
            <div className="absolute inset-0 rounded-2xl border-2 border-[rgba(77,255,160,0.4)] animate-spin [animation-duration:6s] shadow-[0_0_30px_rgba(77,255,160,0.25)]" />
            <div className="absolute inset-2 rounded-xl bg-[#0A1912] border border-[rgba(77,255,160,0.2)] shadow-inner flex items-center justify-center">
              <span className="text-4xl font-extrabold text-[#4DFFA0] font-sans tracking-tighter drop-shadow-[0_0_15px_rgba(77,255,160,0.8)] animate-pulse">
                F
              </span>
            </div>
          </div>

          {/* Branding Wordmark */}
          <div className="text-center space-y-2">
            <div className="flex items-center gap-1.5 text-lg font-bold text-white tracking-wider">
              <span>FLUMENX</span>
              <span className="w-2 h-2 rounded-full bg-[#4DFFA0] shadow-[0_0_8px_#4DFFA0]" />
            </div>
            <p className="text-[10px] font-semibold text-[#89ACA0] tracking-[0.3em] uppercase">
              Connected Workplace Portal
            </p>
          </div>

          {/* Glowing Loading Bar */}
          <div className="w-48 h-1 bg-[#0F2218] rounded-full overflow-hidden border border-[rgba(77,255,160,0.15)] mt-2">
            <div className="h-full bg-gradient-to-r from-[#4DFFA0] via-[#4A9EFF] to-[#4DFFA0] animate-[loadingBar_1s_infinite_linear]" />
          </div>
        </div>
      </div>
      {/* Hide underlying content while loader is active to prevent FOUC */}
      <div className={loading ? "opacity-0" : "opacity-100 transition-opacity duration-300"}>
        {children}
      </div>
    </>
  );
}
