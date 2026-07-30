"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { Maximize2, Move, X } from "lucide-react";

type SvgPreviewPage = {
  page: number;
  filename: string;
  url: string;
};

type SvgPreviewManifest = {
  ok: boolean;
  documentId: string;
  pageCount: number;
  pages: SvgPreviewPage[];
};

type PreviewState = "loading" | "ready" | "error";

export function SvgCvPreview({ documentId, version = 0, mode = "inline" }: { documentId?: string; version?: number; mode?: "inline" | "modal" }) {
  const [state, setState] = useState<PreviewState>("loading");
  const [pages, setPages] = useState<SvgPreviewPage[]>([]);
  const [popupOpen, setPopupOpen] = useState(false);
  const [position, setPosition] = useState({ x: 110, y: 86 });
  const [drag, setDrag] = useState<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (documentId) params.set("documentId", documentId);
    params.set("v", String(version));

    async function loadManifest() {
      setState("loading");
      try {
        const response = await fetch(`/api/cv/preview/manifest?${params.toString()}`, { credentials: "include" });
        const payload = (await response.json()) as SvgPreviewManifest & { error?: string };
        if (!response.ok || !payload.pages?.length) {
          throw new Error(payload.error || "SVG preview is not ready.");
        }
        if (!cancelled) {
          setPages(payload.pages);
          setState("ready");
        }
      } catch {
        if (!cancelled) {
          setPages([]);
          setState("error");
        }
      }
    }

    void loadManifest();
    return () => {
      cancelled = true;
    };
  }, [documentId, version]);

  const canOpen = mode === "inline" && state === "ready";

  function openPopup() {
    if (canOpen) setPopupOpen(true);
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    setDrag({ startX: event.clientX, startY: event.clientY, x: position.x, y: position.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePopup(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    setPosition({
      x: Math.max(16, drag.x + event.clientX - drag.startX),
      y: Math.max(16, drag.y + event.clientY - drag.startY)
    });
  }

  function stopDrag(event: React.PointerEvent<HTMLDivElement>) {
    setDrag(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    // Keep trackpad/mouse wheel scroll inside the preview; do not bubble to the page/shell.
    const el = scrollRef.current;
    if (!el) return;
    const canScroll = el.scrollHeight > el.clientHeight + 1;
    if (!canScroll) return;
    // Always consume vertical wheel over the preview so the outer editor does not jump.
    event.stopPropagation();
  }

  return (
    <>
      <div
        className={`svg-cv-preview cv-preview-protected ${mode === "inline" ? "is-inline" : "is-modal"} ${canOpen ? "has-expand" : ""}`}
        aria-busy={state === "loading"}
        onContextMenu={(event) => event.preventDefault()}
        onDragStart={(event) => event.preventDefault()}
      >
        {state === "loading" ? <span className="pdf-render-note">Preparing vector preview</span> : null}
        {state === "error" ? <span className="pdf-render-note">Vector preview is not ready yet.</span> : null}
        {state === "ready" ? (
          <div
            ref={scrollRef}
            className="svg-page-scroll cv-preview-protected"
            aria-label="CV SVG Preview"
            tabIndex={0}
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
            onWheel={handleWheel}
          >
            {pages.map((page) => (
              <figure className="svg-page-shell" key={page.url}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Authenticated SVG preview pages are served by an app route, not optimized raster assets. */}
                <img
                  src={page.url}
                  alt={`CV page ${page.page}`}
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  onContextMenu={(event) => event.preventDefault()}
                  onDragStart={(event) => event.preventDefault()}
                />
              </figure>
            ))}
          </div>
        ) : null}
        {canOpen ? (
          <button
            type="button"
            className="cv-preview-expand"
            onClick={openPopup}
            title="Open larger CV preview"
            aria-label="Open larger CV preview"
          >
            <Maximize2 size={15} aria-hidden="true" />
            <span>Expand</span>
          </button>
        ) : null}
      </div>
      {popupOpen && mode === "inline" ? (
        <div className="pdf-popover-backdrop" role="presentation" onMouseDown={() => setPopupOpen(false)}>
          <section
            className="pdf-popover svg-popover"
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
            <div className="pdf-popover-body">
              <SvgCvPreview documentId={documentId} version={version} mode="modal" />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
