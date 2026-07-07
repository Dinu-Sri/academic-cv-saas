"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { Move, X } from "lucide-react";

type PdfRenderState = "loading" | "ready" | "error";

let workerConfigured = false;

export function PdfCanvasPreview({ sourceUrl, mode = "inline" }: { sourceUrl: string; mode?: "inline" | "modal" }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const renderIdRef = useRef(0);
  const [state, setState] = useState<PdfRenderState>("loading");
  const [popupOpen, setPopupOpen] = useState(false);
  const [position, setPosition] = useState({ x: 110, y: 86 });
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!sourceUrl) return;

    let cancelled = false;
    let resizeTimer: number | null = null;
    let loadingTask: { destroy: () => Promise<void> } | null = null;
    async function renderPdf() {
      const root = rootRef.current;
      const pages = pagesRef.current;
      if (!root || !pages) return;

      const renderId = renderIdRef.current + 1;
      renderIdRef.current = renderId;
      setState("loading");
      pages.replaceChildren();

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

        const pageWidth = Math.max(320, root.clientWidth - 28);
        const outputScale = Math.min(Math.max(window.devicePixelRatio || 1, 1.5) * 2, 4);

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
          pagesRef.current?.replaceChildren();
          setState("error");
        }
      }
    }

    const handleWindowResize = () => {
      if (resizeTimer) {
        window.clearTimeout(resizeTimer);
      }
      resizeTimer = window.setTimeout(() => {
        void renderPdf();
      }, 220);
    };

    void renderPdf();
    window.addEventListener("resize", handleWindowResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleWindowResize);
      if (resizeTimer) {
        window.clearTimeout(resizeTimer);
      }
      void loadingTask?.destroy();
    };
  }, [sourceUrl]);

  const canOpen = mode === "inline" && state === "ready";

  function openPopup() {
    if (canOpen) {
      setPopupOpen(true);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!canOpen) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setPopupOpen(true);
    }
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      x: position.x,
      y: position.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePopup(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    setPosition({
      x: Math.max(16, drag.x + event.clientX - drag.startX),
      y: Math.max(16, drag.y + event.clientY - drag.startY)
    });
  }

  function stopDrag(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <>
      <div
        className={`pdf-canvas-preview ${canOpen ? "is-clickable" : ""}`}
        ref={rootRef}
        aria-busy={state === "loading"}
        role={canOpen ? "button" : undefined}
        tabIndex={canOpen ? 0 : undefined}
        onClick={openPopup}
        onKeyDown={handleKeyDown}
        title={canOpen ? "Open larger CV preview" : undefined}
      >
        {state === "loading" ? <span className="pdf-render-note">Loading PDF preview</span> : null}
        {state === "error" ? <span className="pdf-render-note">Could not show the PDF preview.</span> : null}
        <div className="pdf-canvas-pages" ref={pagesRef} />
      </div>
      {popupOpen && mode === "inline" ? (
        <div className="pdf-popover-backdrop" role="presentation" onMouseDown={() => setPopupOpen(false)}>
          <section
            className="pdf-popover"
            role="dialog"
            aria-modal="true"
            aria-label="CV preview"
            style={{ left: position.x, top: position.y }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div
              className="pdf-popover-header"
              onPointerDown={startDrag}
              onPointerMove={movePopup}
              onPointerUp={stopDrag}
              onPointerCancel={stopDrag}
            >
              <span><Move size={16} /> CV Preview</span>
              <div>
                <button
                  className="icon-button"
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setPopupOpen(false)}
                  aria-label="Close CV preview"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="pdf-popover-body">
              <PdfCanvasPreview sourceUrl={sourceUrl} mode="modal" />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
