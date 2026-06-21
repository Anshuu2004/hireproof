"use client";

/**
 * Layer 0 — the WebGL galaxy backdrop.
 *
 * A whole sky of small, tilted elliptical galaxies — every verified human is a
 * genuine celestial body with a real gold nucleus; a fake is a flat image that
 * doesn't survive the loop. Scrolling the site dives through that cosmos.
 *
 * Implemented EXACTLY per the brief's Appendix A: same geometry, shaders,
 * colours, motion, layers, three composers and postprocessing. The only
 * additions are the documented integration rules (DPR cap, pause-when-hidden,
 * dispose-on-unmount, page-scroll driven). No pointer interaction — serene.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { GammaCorrectionShader } from "three/examples/jsm/shaders/GammaCorrectionShader.js";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader.js";

/* ------------------------------------------------------------------ helpers */
const Lerp = (a: number, b: number, t = 0.075) => a + (b - a) * t;
function hexToVec3(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* ------------------------------------------------------- fixed parameters */
const coreColor = "#fff3b0"; // bright gold nucleus — verified human
const midColor = "#ffb52a"; // warm amber body
const rimColor = "#3a1402"; // near-black deep-brown rim
const twinkleColor = "#ff5e8a"; // pink-rose twinkle accent — liveness
const galaxyCount = 79;
const spread = 13;
const tumbleSpeed = 0.2;
const wobbleAmount = 0.205;
const wobbleSpeed = 0.35;
const gradientPow = 0.2;
const twinkleAmount = 0.71;
const twinkleSpeed = 2.45;
const scrollDiveZ = 4;
const scrollSpin = 2.62;
const scrollExpand = 1;
const cornerBlue = "#ffcf2a";
const cornerOrange = "#ff3b1f";
const atmoColor = "#ffd9a0"; // gold ambient motes
const atmoCount = 350;
const atmoSize = 14;
const atmoSpeed = 0.8;

const LAYERS = { NONE: 0, TORUS_SCENE: 1, BLOOM_SCENE: 2, ENTIRE_SCENE: 3 };

/* -------------------------------------------------- FinalPass composite shader */
const FinalPassVertex = /* glsl */ `
varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`;

const FinalPassFragment = /* glsl */ `
uniform float iTime; uniform sampler2D tDiffuse; uniform sampler2D bloomTexture; uniform sampler2D torusTexture; uniform sampler2D haloTexture;
uniform vec3 iCornerBlue; uniform vec3 iCornerOrange; varying vec2 vUv;
vec3 warp3d(vec3 pos, float t) {
  float curv = .8, a = 1.9, b = 0.7; pos *= 2.;
  pos.x += curv * sin(t + a * pos.y) + t * b; pos.y += curv * cos(t + a * pos.x);
  pos.y += curv * sin(t + a * pos.z) + t * b; pos.z += curv * cos(t + a * pos.y);
  pos.z += curv * sin(t + a * pos.x) + t * b; pos.x += curv * cos(t + a * pos.z);
  return 0.5 + 0.5 * cos(pos.xyz + vec3(1, 2, 4));
}
void main() {
  vec2 uv = 2. * vUv - 1.;
  vec3 w = pow(warp3d(vec3(uv.x, sin(uv.y), uv.y), iTime * 1.5), vec3(1.5));
  vec3 col = 1.5 * iCornerBlue * w.x; col *= w.y; col += iCornerOrange * w.z;
  col *= smoothstep(0.6, 1., abs(uv.y));
  col *= smoothstep(-.5, 1., -uv.y * uv.x); col *= smoothstep(-.5, 1., -uv.y * uv.x);
  vec3 halo = texture2D(haloTexture, vUv).xyz;
  vec3 atmoBg = vec3(0.02, 0.03, 0.10) * (1.0 - 0.4 * length(uv));
  gl_FragColor = vec4(atmoBg + col * 0.2 + texture2D(bloomTexture, vUv).xyz + texture2D(torusTexture, vUv).xyz + texture2D(tDiffuse, vUv).xyz + halo, 1.);
}`;

/* -------------------------------------------------- galaxy points shaders */
const PointsVertex = /* glsl */ `
attribute float size; attribute float id; attribute float shell;
uniform float iTime; uniform float iAnimate; uniform float uExpand;
uniform float uWobbleAmount; uniform float uWobbleSpeed;
varying float vShell; varying float vId;
void main() {
  vShell = shell; vId = id;
  float ph = id * 6.2831853;
  vec3 wob = vec3(sin(iTime * uWobbleSpeed + ph),
                  cos(iTime * uWobbleSpeed * 1.3 + ph),
                  sin(iTime * uWobbleSpeed * 0.7 + ph)) * uWobbleAmount;
  vec3 p = (position + wob) * uExpand;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = size / -mv.z * (0.5 + 0.5 * iAnimate);
  vec4 res = projectionMatrix * mv;
  float a = pow(iAnimate, 0.6);
  res.xy *= clamp(2.0 * a + pow(id, 0.7) - 1.0, 0.0, 1.0);
  gl_Position = res;
}`;

const PointsFragment = /* glsl */ `
uniform float iTime; uniform float uOpacity;
uniform vec3 uCore; uniform vec3 uMid; uniform vec3 uRim; uniform vec3 uTwinkle;
uniform float uGradientPow; uniform float uTwinkleAmount; uniform float uTwinkleSpeed;
varying float vShell; varying float vId;
vec3 grad3(vec3 a, vec3 b, vec3 c, float t) {
  return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, clamp((t - 0.5) * 2.0, 0.0, 1.0));
}
void main() {
  float t = pow(vShell, uGradientPow);
  vec3 col = grad3(uCore, uMid, uRim, t);
  float tw = 0.5 + 0.5 * sin(iTime * uTwinkleSpeed + vId * 100.0);
  col = mix(col, uTwinkle, tw * uTwinkleAmount * (1.0 - t));
  col *= (0.45 + 0.85 * (1.0 - t));
  float tex = 1.0 - smoothstep(0.5, 1.0, length(2.0 * gl_PointCoord - 1.0));
  gl_FragColor = vec4(col * tex, tex * uOpacity);
}`;

/* -------------------------------------------------- atmosphere shaders */
const AtmoVertex = /* glsl */ `
attribute float size; attribute float seed; uniform float uTime; uniform vec2 uRes;
varying float vA;
vec3 warp(vec3 p, float t){ float c=0.9,a=1.9,b=0.02,s=0.05; p*=2.;
  p.x+=c*sin(s*t+a*p.y)+t*b; p.y+=c*cos(s*t+a*p.x); p.y+=c*sin(s*t+a*p.z)+t*b;
  p.z+=c*cos(s*t+a*p.y); p.z+=c*sin(s*t+a*p.x)+t*b; p.x+=c*cos(s*t+a*p.z);
  return cos(p+vec3(1,2,4)); }
void main(){
  vec3 v = position*4.0 + warp(position, uTime)*1.2;
  vec4 mv = modelViewMatrix * vec4(v, 1.0);
  float r = length(v); float farF = 1.0 - smoothstep(5.0, 6.5, r); float nearF = smoothstep(0.0, 0.5, -mv.z);
  vA = farF * nearF;
  gl_PointSize = size * uRes.y / 900.0 / -mv.z; gl_PointSize = max(gl_PointSize, 1.0);
  gl_Position = projectionMatrix * mv;
}`;

const AtmoFragment = /* glsl */ `
uniform vec3 uColor; varying float vA;
void main(){ vec2 p = gl_PointCoord - 0.5; float l = length(p); if (l > 0.5) discard;
  float tex = smoothstep(0.5, 0.0, l); gl_FragColor = vec4(uColor * tex, tex * vA * 0.55); }`;

/* ----------------------------------------------------------------- Galaxy */
class Galaxy {
  R = 1.7;
  count = { stars: 90000 };
  instance: THREE.Group;
  cloud: THREE.Points;
  atmo: THREE.Points;
  material: THREE.ShaderMaterial;
  start = performance.now();

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    /* ---- galaxy field ---- */
    const geo = this.geometry();
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iAnimate: { value: 0 },
        uOpacity: { value: 1 },
        uExpand: { value: 1 },
        uWobbleAmount: { value: wobbleAmount },
        uWobbleSpeed: { value: wobbleSpeed },
        uCore: { value: hexToVec3(coreColor) },
        uMid: { value: hexToVec3(midColor) },
        uRim: { value: hexToVec3(rimColor) },
        uTwinkle: { value: hexToVec3(twinkleColor) },
        uGradientPow: { value: gradientPow },
        uTwinkleAmount: { value: twinkleAmount },
        uTwinkleSpeed: { value: twinkleSpeed },
      },
      vertexShader: PointsVertex,
      fragmentShader: PointsFragment,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      transparent: true,
    });
    this.cloud = new THREE.Points(geo, this.material);
    this.cloud.position.set(0, 0, -0.8);
    this.cloud.layers.set(LAYERS.ENTIRE_SCENE); // not BLOOM_SCENE — fine points flicker under bloom

    this.instance = new THREE.Group();
    this.instance.add(this.cloud);
    this.instance.position.z = -20; // slides to 0 on appear-in
    scene.add(this.instance);

    /* ---- ambient gold motes ---- */
    this.atmo = this.atmosphere(camera);
    this.atmo.frustumCulled = false;
    this.atmo.layers.set(LAYERS.ENTIRE_SCENE);
    scene.add(this.atmo);
  }

  geometry() {
    const N = this.count.stars; // 90000
    const positions = new Float32Array(N * 3),
      shells = new Float32Array(N),
      sizes = new Float32Array(N),
      ids = new Float32Array(N);
    const K = Math.max(1, Math.round(galaxyCount)); // 79
    const SP = spread; // 13
    const frames: {
      m: THREE.Matrix4;
      size: number;
      ecc: number;
      thick: number;
      ox: number;
      oy: number;
      oz: number;
    }[] = [];
    for (let k = 0; k < K; k++) {
      frames.push({
        m: new THREE.Matrix4().makeRotationFromEuler(
          new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
        ),
        size: 0.18 + 0.34 * Math.random(),
        ecc: 0.45 + 0.42 * Math.random(),
        thick: 0.06 + 0.05 * Math.random(),
        ox: (Math.random() - 0.5) * 2 * SP,
        oy: (Math.random() - 0.5) * 2 * SP,
        oz: (Math.random() - 0.5) * 2 * SP * 0.6,
      });
    }
    const tmp = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const f = frames[i % K];
      const th = Math.random() * 2 * Math.PI;
      const rad = Math.pow(Math.random(), 1.4);
      const rx = f.size * this.R * rad;
      const rz = f.size * this.R * f.ecc * rad;
      const y = (Math.random() - 0.5) * 2 * f.thick * this.R * rad;
      tmp.set(rx * Math.cos(th), y, rz * Math.sin(th)).applyMatrix4(f.m);
      tmp.x += f.ox;
      tmp.y += f.oy;
      tmp.z += f.oz;
      positions[i * 3] = tmp.x;
      positions[i * 3 + 1] = tmp.y;
      positions[i * 3 + 2] = tmp.z;
      shells[i] = rad;
      sizes[i] = 6 + 9 * Math.random();
      ids[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("shell", new THREE.BufferAttribute(shells, 1));
    g.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    g.setAttribute("id", new THREE.BufferAttribute(ids, 1));
    return g;
  }

  atmosphere(camera: THREE.PerspectiveCamera) {
    const N = Math.round(atmoCount); // 350
    const positions = new Float32Array(N * 3),
      sizes = new Float32Array(N),
      seeds = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      positions[i * 3] = 2 * Math.random() - 1;
      positions[i * 3 + 1] = 2 * Math.random() - 1;
      positions[i * 3 + 2] = 2 * Math.random() - 1;
      sizes[i] = atmoSize * (0.4 + Math.random());
      seeds[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    g.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: hexToVec3(atmoColor) },
        uRes: {
          value: new THREE.Vector2(
            window.innerWidth * window.devicePixelRatio,
            window.innerHeight * window.devicePixelRatio
          ),
        },
      },
      vertexShader: AtmoVertex,
      fragmentShader: AtmoFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const pts = new THREE.Points(g, m);
    pts.onBeforeRender = () => {
      const t = performance.now() / 1000;
      m.uniforms.uTime.value = t * atmoSpeed * 8.0;
      pts.position.copy(camera.position); // motes follow the camera
    };
    return pts;
  }

  render(scrollT: number) {
    const t = performance.now() / 1000;
    this.material.uniforms.iTime.value = t;

    /* appear-in (once) */
    const elapsed = performance.now() - this.start;
    if (elapsed < 2000) {
      const tAnim = clamp(elapsed / 2000, 0, 1);
      this.material.uniforms.iAnimate.value = tAnim * tAnim * (3 - 2 * tAnim);
    } else {
      this.material.uniforms.iAnimate.value = 1;
    }
    if (elapsed >= 500) {
      const tSlide = clamp((elapsed - 500) / 1500, 0, 1);
      const target = -20 + (0 - -20) * (1 - Math.pow(1 - tSlide, 4));
      this.instance.position.z = Lerp(this.instance.position.z, target, 1);
      this.material.uniforms.uOpacity.value = clamp(tSlide, 0, 1);
    }

    /* scroll-driven dive / spin-up / expand */
    const dt = Math.min(0.05, t - this.last);
    this.last = t;
    this.material.uniforms.uExpand.value = 1 + scrollT * scrollExpand;
    const spin = tumbleSpeed * (1 + scrollT * scrollSpin) * dt;
    this.cloud.rotation.y += spin;
    this.cloud.rotation.x += spin * 0.35;
  }
  last = performance.now() / 1000;

  dispose() {
    this.cloud.geometry.dispose();
    this.material.dispose();
    this.atmo.geometry.dispose();
    (this.atmo.material as THREE.ShaderMaterial).dispose();
  }
}

/* ====================================================================== */
export default function GalaxyBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;

    /* ---- renderer ---- */
    // WebGL1 context creation can still fail at runtime on some GPUs/drivers even
    // after the capability probe passed; fail gracefully so the static sky (already
    // mounted behind this canvas) remains the backdrop instead of crashing the tree.
    let renderer: THREE.WebGL1Renderer | null = null;
    try {
      renderer = new THREE.WebGL1Renderer({ canvas, antialias: true });
    } catch {
      renderer = null;
    }
    if (!renderer) return;
    const dprCap =
      navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4 ? 1.5 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 0, 15);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 80);
    camera.position.set(0, 0, 14);
    camera.layers.enable(LAYERS.TORUS_SCENE);
    camera.layers.enable(LAYERS.BLOOM_SCENE);
    camera.layers.enable(LAYERS.ENTIRE_SCENE);
    scene.add(camera);

    /* ---- postprocessing: three composers sharing one RenderPass ---- */
    const renderScene = new RenderPass(scene, camera);

    const torusComposer = new EffectComposer(renderer);
    torusComposer.renderToScreen = false;
    torusComposer.addPass(renderScene);
    torusComposer.addPass(new ShaderPass(GammaCorrectionShader));
    torusComposer.addPass(
      new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.22, 0.2, 0)
    );
    torusComposer.addPass(new ShaderPass(CopyShader));

    const bloomComposer = new EffectComposer(renderer);
    bloomComposer.renderToScreen = false;
    bloomComposer.addPass(renderScene);
    bloomComposer.addPass(
      new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.5, 0)
    );
    bloomComposer.addPass(new ShaderPass(GammaCorrectionShader));

    const FinalPass = {
      uniforms: {
        iTime: { value: 0 },
        tDiffuse: { value: null as THREE.Texture | null },
        torusTexture: { value: null as THREE.Texture | null },
        bloomTexture: { value: null as THREE.Texture | null },
        haloTexture: { value: null as THREE.Texture | null },
        iCornerBlue: { value: hexToVec3(cornerBlue) },
        iCornerOrange: { value: hexToVec3(cornerOrange) },
      },
      vertexShader: FinalPassVertex,
      fragmentShader: FinalPassFragment,
    };

    const finalComposer = new EffectComposer(renderer);
    finalComposer.addPass(renderScene);
    const finalPass = new ShaderPass(FinalPass);
    finalPass.uniforms.bloomTexture.value = bloomComposer.renderTarget1.texture;
    finalPass.uniforms.torusTexture.value = torusComposer.renderTarget1.texture;
    finalComposer.addPass(finalPass);

    /* ---- the galaxy ---- */
    const galaxy = new Galaxy(scene, camera);

    /* ---- scroll mapping (page scroll drives the camera) ----
       The scroll target is computed inside the render loop from a CACHED page
       height, so the only layout-forcing read (scrollHeight) happens on resize /
       load — never per scroll tick. No scroll listener needed: the RAF loop
       already samples once per frame. */
    let scrollCurrent = 0;
    let docMax = 0;
    const recalcMax = () => {
      docMax = document.documentElement.scrollHeight - window.innerHeight;
    };
    recalcMax();
    window.addEventListener("load", recalcMax);

    /* ---- resize (passive + coalesced to one rAF; reallocates targets once) ---- */
    let resizeRaf = 0;
    const applyResize = () => {
      resizeRaf = 0;
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      [torusComposer, bloomComposer, finalComposer].forEach((c) => {
        c.setPixelRatio(dpr);
        c.setSize(w, h);
      });
      (galaxy.atmo.material as THREE.ShaderMaterial).uniforms.uRes.value.set(w * dpr, h * dpr);
      recalcMax();
    };
    const onResize = () => {
      if (!resizeRaf) resizeRaf = requestAnimationFrame(applyResize);
    };
    window.addEventListener("resize", onResize, { passive: true });

    /* ---- render loop (paused when the tab is hidden) ---- */
    let raf = 0;
    const render = () => {
      raf = requestAnimationFrame(render);
      const scrollTarget = clamp(docMax > 0 ? window.scrollY / docMax : 0, 0, 1);
      scrollCurrent = Lerp(scrollCurrent, scrollTarget, 0.08);
      camera.position.z = 14 - scrollCurrent * scrollDiveZ;
      galaxy.render(scrollCurrent);
      finalPass.uniforms.iTime.value = performance.now() / 1000;
      camera.layers.set(LAYERS.TORUS_SCENE);
      torusComposer.render();
      camera.layers.set(LAYERS.BLOOM_SCENE);
      bloomComposer.render();
      camera.layers.set(LAYERS.ENTIRE_SCENE);
      finalComposer.render();
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf && !disposed) {
        galaxy.last = performance.now() / 1000; // avoid a dt spike after the pause
        raf = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(render);

    /* ---- dispose on unmount ---- */
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeRaf);
      window.removeEventListener("load", recalcMax);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      galaxy.dispose();
      // EffectComposer.dispose() exists at runtime in r143 but is absent from the
      // shipped type declarations — call it if present, else free its targets.
      const disposeComposer = (c: EffectComposer) => {
        const d = (c as unknown as { dispose?: () => void }).dispose;
        if (typeof d === "function") d.call(c);
        else {
          c.renderTarget1.dispose();
          c.renderTarget2.dispose();
        }
      };
      disposeComposer(torusComposer);
      disposeComposer(bloomComposer);
      disposeComposer(finalComposer);
      // dispose() alone keeps the GL context alive; force-release it so navigating
      // in/out of "/" doesn't leak a context per round-trip (browser caps ~16).
      renderer.forceContextLoss();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} id="scene" className="hp-galaxy-canvas" aria-hidden="true" />;
}
