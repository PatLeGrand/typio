"use client";

import { useEffect, useId, useRef } from "react";
import { usePhysicalKeyboard } from "@/components/race/usePhysicalKeyboard";

export function HomeRaceTrack() {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const progressRef = useRef<SVGPathElement>(null);
  const runnerRef = useRef<SVGGElement>(null);
  const physicalKeyboard = usePhysicalKeyboard();
  const pathId = useId();
  const arrived = useRef(false);

  useEffect(() => {
    const svg = svgRef.current;
    const host = svg?.parentElement;
    const path = pathRef.current;
    const progress = progressRef.current;
    const runner = runnerRef.current;
    if (typeof ResizeObserver === "undefined") return;
    if (!svg || !host || !path || !progress || !runner) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let frame = 0;
    let context: ReturnType<typeof import("gsap").gsap.context> | undefined;
    let animate: (() => void) | undefined;
    let loading = false;
    let runnerRoute = "";
    let startY = 0;
    let routeEase = (value: number) => value;

    function measure() {
      frame = 0;
      context?.revert();
      context = undefined;
      if (!desktop.matches) return;
      const bounds = host!.getBoundingClientRect();
      const anchors = Array.from(host!.querySelectorAll<HTMLElement>("[data-track-point]"));
      const points = anchors.map((anchor) => {
        const rect = anchor.getBoundingClientRect();
        return { x: rect.left - bounds.left, y: rect.top - bounds.top };
      });
      if (!points.length || !bounds.width || !bounds.height) return;
      // Les ancres réservent 80 px sur le côté et 32 px autour de chaque bloc.
      const heroTrack = host!.previousElementSibling?.querySelector<HTMLElement>("[data-home-race-track]");
      const typingPanel = host!.previousElementSibling?.querySelector<HTMLElement>("[data-home-typing]")?.getBoundingClientRect();
      startY = heroTrack ? heroTrack.getBoundingClientRect().bottom - bounds.top - 40 : 0;
      points.unshift({ x: typingPanel ? Math.min(points[0].x, typingPanel.right - bounds.left - 40) : points[0].x, y: startY });
      const finish = points[points.length - 1];
      // Le bas du personnage (22 px) s’arrête au début du damier (20 px).
      const end = { x: finish.x, y: finish.y - 42 };
      // Une approche verticale garde aussi le personnage à l’écart du drapeau.
      points.splice(points.length - 1, 1, { x: finish.x, y: finish.y - 160 }, end);
      const d = points.reduce((route, point, index) => {
        if (!index) return `M ${point.x} ${point.y}`;
        const previous = points[index - 1];
        const middle = (previous.y + point.y) / 2;
        return `${route} C ${previous.x} ${middle}, ${point.x} ${middle}, ${point.x} ${point.y}`;
      }, "");
      runnerRoute = d;
      const route = `${d} L ${finish.x} ${finish.y}`;
      svg!.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
      path!.setAttribute("d", route);
      progress!.setAttribute("d", route);
      const runnerLength = path!.getTotalLength() - 42;
      const samples = Array.from({ length: 257 }, (_, index) => path!.getPointAtLength(runnerLength * index / 256).y);
      // Le défilement avance en y ; MotionPath avance en longueur d’arc.
      routeEase = (value) => {
        const y = startY + (end.y - startY) * value;
        let low = 0;
        let high = samples.length - 1;
        while (high - low > 1) {
          const middle = (low + high) >> 1;
          if (samples[middle] < y) low = middle;
          else high = middle;
        }
        const span = samples[high] - samples[low];
        return (low + (span > 0 ? (y - samples[low]) / span : 0)) / 256;
      };
      runner!.setAttribute("transform", `translate(${end.x} ${end.y})`);
      runner!.style.visibility = "visible";
      if (physicalKeyboard && !motion.matches) animate?.();
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(measure);
    }

    function syncMotion() {
      schedule();
      if (!physicalKeyboard || motion.matches || loading || animate) return;
      loading = true;
      void Promise.all([import("gsap"), import("gsap/ScrollTrigger"), import("gsap/MotionPathPlugin")]).then(([{ gsap }, { ScrollTrigger }, { MotionPathPlugin }]) => {
        if (disposed) return;
        gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);
        animate = () => {
          context = gsap.context(() => {}, host!);
          context.add(() => {
            const finish = host!.querySelector("[data-track-point='finish']");
            const flag = host!.querySelector("[data-track-flag]");
            const route = runnerRoute;
            gsap.set(runner, { motionPath: { path: route, start: 0, end: 0 } });
            const timeline = gsap.timeline({
              defaults: { ease: "none" },
              scrollTrigger: {
                trigger: host, start: `top+=${startY} center`, endTrigger: finish, end: "top center", scrub: true,
                onUpdate: (trigger) => {
                  if (trigger.progress < 1 || arrived.current || !flag) return;
                  arrived.current = true;
                  context?.add(() => { gsap.to(flag, { rotation: -12, duration: 0.18, repeat: 1, yoyo: true }); });
                },
              },
            });
            timeline.fromTo(progress, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1, ease: routeEase }, 0);
            timeline.to(runner, { motionPath: { path: route, autoRotate: false }, duration: 1, ease: routeEase }, 0);
          });
        };
        schedule();
      }).catch(() => { loading = false; });
    }

    const observer = new ResizeObserver(schedule);
    observer.observe(host);
    if (host.previousElementSibling) observer.observe(host.previousElementSibling);
    host.querySelectorAll("section").forEach((section) => observer.observe(section));
    desktop.addEventListener("change", syncMotion);
    motion.addEventListener("change", syncMotion);
    syncMotion();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      desktop.removeEventListener("change", syncMotion);
      motion.removeEventListener("change", syncMotion);
      context?.revert();
    };
  }, [physicalKeyboard]);

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-6 border-l-[8px] border-dashed border-accent-text/40 md:hidden" />
      <svg ref={svgRef} aria-hidden="true" focusable="false" className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible md:block" fill="none">
        <defs><path ref={pathRef} id={pathId} /></defs>
        <use href={`#${pathId}`} className="stroke-border" strokeWidth={60} strokeLinecap="butt" />
        <use href={`#${pathId}`} className="stroke-island-sand" strokeWidth={52} strokeLinecap="butt" />
        <path ref={progressRef} pathLength={1} className="stroke-accent-text/30" strokeWidth={52} strokeLinecap="butt" strokeDasharray="1" />
        <use href={`#${pathId}`} className="stroke-muted" strokeWidth={2} strokeDasharray="12 16" />
        <g ref={runnerRef} style={{ visibility: "hidden" }}>
          <image href="/race/blob.svg" x={-22} y={-22} width={44} height={44} />
        </g>
      </svg>
    </>
  );
}
