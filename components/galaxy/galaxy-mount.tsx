"use client";

/**
 * Singleton mount for the galaxy backdrop.
 *
 * Lives in the root layout but only renders on the landing route ("/"), so the
 * camera-heavy /verify · /v · /employer flows are never burdened with a second
 * WebGL context (and the fixed canvas never stacks over their UI).
 *
 * If WebGL is unavailable or the visitor prefers reduced motion, we render a
 * static CSS sky instead — same mood, no motion (brief §4 fallback).
 */

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const GalaxyBackdrop = dynamic(() => import("./galaxy-backdrop"), { ssr: false });

function webglAvailable() {
  try {
    if (!window.WebGLRenderingContext) return false;
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") || c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    // release the probe context so it doesn't count against the browser's
    // context budget — otherwise the real renderer can fail to get one.
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export default function GalaxyMount() {
  const pathname = usePathname();
  const [mode, setMode] = useState<"pending" | "live" | "static">("pending");

  useEffect(() => {
    // Capability detection must run after hydration (matchMedia/WebGL are unknown
    // at SSR); rendering identical markup first avoids a hydration mismatch.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(reduce || !webglAvailable() ? "static" : "live");
  }, []);

  if (pathname !== "/") return null;

  return (
    <>
      {/* base layer — also the graceful fallback before/instead of the canvas */}
      <div className="hp-static-sky" aria-hidden="true" />
      {mode === "live" && <GalaxyBackdrop />}
    </>
  );
}
