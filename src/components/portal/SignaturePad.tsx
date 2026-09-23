"use client";

import * as React from "react";
import { Eraser } from "lucide-react";

/** Canvas signature capture. Writes a PNG data URL into a hidden input named `name`. */
export function SignaturePad({ name = "signature" }: { name?: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const drawing = React.useRef(false);
  const [empty, setEmpty] = React.useState(true);

  React.useEffect(() => {
    const canvas = canvasRef.current!;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#191919";
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const commit = () => {
    if (inputRef.current && canvasRef.current) inputRef.current.value = canvasRef.current.toDataURL("image/png");
  };

  return (
    <div>
      <div className="relative rounded-2xl border-2 border-dashed border-ink/20 bg-white">
        <canvas
          ref={canvasRef}
          className="h-40 w-full touch-none cursor-crosshair rounded-2xl"
          aria-label="Draw your signature"
          onPointerDown={(e) => {
            drawing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            const ctx = canvasRef.current!.getContext("2d")!;
            const p = pos(e);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = canvasRef.current!.getContext("2d")!;
            const p = pos(e);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            setEmpty(false);
          }}
          onPointerUp={() => {
            drawing.current = false;
            commit();
          }}
          onPointerLeave={() => {
            if (drawing.current) commit();
            drawing.current = false;
          }}
        />
        {empty && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ink/30">Sign here with your mouse, finger or stylus</span>}
        <span className="pointer-events-none absolute bottom-8 left-6 right-6 border-b border-ink/20" />
      </div>
      <button
        type="button"
        className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-sm font-bold text-ink/60 hover:text-maroon"
        onClick={() => {
          const c = canvasRef.current!;
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          if (inputRef.current) inputRef.current.value = "";
          setEmpty(true);
        }}
      >
        <Eraser className="h-4 w-4" /> Clear
      </button>
      <input ref={inputRef} type="hidden" name={name} />
    </div>
  );
}
