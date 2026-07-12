"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { Move, X } from "lucide-react";
import type { PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";

type PdfRenderState = "loading" | "ready" | "error";

export function PdfCanvasPreview({ sourceUrl, mode = "inline" }: { sourceUrl: string; mode?: "inline" | "modal" }) {
  const [state, setState] = useState<PdfRenderState>("loading");
  const [popupOpen, setPopupOpen] = useState(false);
  const [position, setPosition] = useState({ x: 110, y: 86 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    const updateSize = () => {
      const nextSize = {
        width: Math.floor(preview.clientWidth),
        height: Math.floor(preview.clientHeight)
      };

      if (nextSize.width === sizeRef.current.width && nextSize.height === sizeRef.current.height) {
        return;
      }

      sizeRef.current = nextSize;
      setViewportSize(nextSize);
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(preview);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const pagesHost = pagesRef.current;
    if (!sourceUrl || !pagesHost || viewportSize.width < 160 || viewportSize.height < 160) return;

    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    const renderTasks: RenderTask[] = [];

    async function renderPdf() {
      const host = pagesRef.current;
      if (!host) return;

      setState("loading");
      host.innerHTML = "";

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        loadingTask = pdfjs.getDocument({ url: sourceUrl });
        const pdf = await loadingTask.promise;
        const inlineMode = mode === "inline";
        const pagesToRender = inlineMode ? [1] : Array.from({ length: pdf.numPages }, (_, index) => index + 1);
        const availableWidth = Math.max(180, viewportSize.width - 20);
        const availableHeight = Math.max(180, viewportSize.height - 20);
        const pixelRatio = inlineMode
          ? Math.min(Math.max(window.devicePixelRatio || 1, 2.6), 4)
          : Math.min(Math.max(window.devicePixelRatio || 1, 2), 3.2);

        for (const pageNumber of pagesToRender) {
          if (cancelled) return;

          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const cssScale = inlineMode
            ? Math.min(availableWidth / baseViewport.width, availableHeight / baseViewport.height)
            : availableWidth / baseViewport.width;
          const renderViewport = page.getViewport({ scale: cssScale * pixelRatio });
          const canvas = document.createElement("canvas");
          const canvasContext = canvas.getContext("2d", { alpha: false });

          if (!canvasContext) {
            throw new Error("Could not prepare PDF preview canvas.");
          }

          canvas.className = "pdf-page-canvas";
          canvas.width = Math.ceil(renderViewport.width);
          canvas.height = Math.ceil(renderViewport.height);
          canvas.style.width = `${Math.floor(baseViewport.width * cssScale)}px`;
          canvas.style.height = `${Math.floor(baseViewport.height * cssScale)}px`;
          canvasContext.fillStyle = "#fff";
          canvasContext.fillRect(0, 0, canvas.width, canvas.height);
          canvasContext.imageSmoothingEnabled = true;
          canvasContext.imageSmoothingQuality = "high";

          host.appendChild(canvas);
          if (!cancelled) {
            setState("ready");
          }
          const renderTask = page.render({ canvas, canvasContext, viewport: renderViewport });
          renderTasks.push(renderTask);
          await renderTask.promise;
        }

        if (!cancelled) {
          setState("ready");
        }
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.name === "RenderingCancelledException")) {
          setState("error");
        }
      }
    }

    void renderPdf();

    return () => {
      cancelled = true;
      renderTasks.forEach((task) => task.cancel());
      void loadingTask?.destroy();
    };
  }, [mode, sourceUrl, viewportSize.height, viewportSize.width]);

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
        ref={previewRef}
        className={`pdf-canvas-preview ${canOpen ? "is-clickable" : ""} ${mode === "inline" ? "is-inline" : "is-modal"}`}
        aria-busy={state === "loading"}
        role={canOpen ? "button" : undefined}
        tabIndex={canOpen ? 0 : undefined}
        onClick={openPopup}
        onKeyDown={handleKeyDown}
        title={canOpen ? "Open larger CV preview" : undefined}
        onContextMenu={(event) => event.preventDefault()}
      >
        {state === "loading" ? <span className="pdf-render-note">Loading PDF preview</span> : null}
        {state === "error" ? <span className="pdf-render-note">Could not show the PDF preview.</span> : null}
        <div ref={pagesRef} className={`pdf-page-scroll ${mode === "inline" ? "is-inline" : "is-modal"}`} aria-label="CV PDF Preview" />
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
