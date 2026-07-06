"use client";

import { useEffect, useRef, useState } from "react";

type PdfRenderState = "loading" | "ready" | "error";

let workerConfigured = false;

export function PdfCanvasPreview({ sourceUrl }: { sourceUrl: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const renderIdRef = useRef(0);
  const [state, setState] = useState<PdfRenderState>("loading");

  useEffect(() => {
    if (!sourceUrl) return;

    let cancelled = false;
    let resizeTimer: number | null = null;
    let loadingTask: { destroy: () => Promise<void> } | null = null;
    const renderId = renderIdRef.current + 1;
    renderIdRef.current = renderId;

    async function renderPdf() {
      const root = rootRef.current;
      if (!root) return;

      setState("loading");
      root.replaceChildren();

      try {
        const pdfjs = await import("pdfjs-dist");
        if (!workerConfigured) {
          pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
          workerConfigured = true;
        }

        const task = pdfjs.getDocument({ url: sourceUrl });
        loadingTask = task;
        const pdf = await task.promise;
        if (cancelled || renderIdRef.current !== renderId) return;

        const pages = document.createElement("div");
        pages.className = "pdf-canvas-pages";
        root.replaceChildren(pages);

        const pageWidth = Math.max(320, root.clientWidth - 28);
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled || renderIdRef.current !== renderId) return;

          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = pageWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d", { alpha: false });

          if (!context) {
            throw new Error("Canvas is not available.");
          }

          canvas.className = "pdf-canvas-page";
          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          pages.appendChild(canvas);

          const renderTask = page.render({
            canvas,
            canvasContext: context,
            viewport,
            transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0]
          });
          await renderTask.promise;
        }

        if (!cancelled && renderIdRef.current === renderId) {
          setState("ready");
        }
      } catch {
        if (!cancelled && renderIdRef.current === renderId) {
          rootRef.current?.replaceChildren();
          setState("error");
        }
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) {
        window.clearTimeout(resizeTimer);
      }
      resizeTimer = window.setTimeout(() => {
        void renderPdf();
      }, 180);
    });

    void renderPdf();
    if (rootRef.current) {
      resizeObserver.observe(rootRef.current);
    }

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      if (resizeTimer) {
        window.clearTimeout(resizeTimer);
      }
      void loadingTask?.destroy();
    };
  }, [sourceUrl]);

  return (
    <div className="pdf-canvas-preview" ref={rootRef} aria-busy={state === "loading"}>
      {state === "loading" ? <span className="pdf-render-note">Loading PDF preview</span> : null}
      {state === "error" ? <span className="pdf-render-note">Could not show the PDF preview.</span> : null}
    </div>
  );
}
