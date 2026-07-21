"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { Move, X } from "lucide-react";

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

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!canOpen) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setPopupOpen(true);
    }
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

  return (
    <>
      <div
        className={`svg-cv-preview cv-preview-protected ${canOpen ? "is-clickable" : ""} ${mode === "inline" ? "is-inline" : "is-modal"}`}
        aria-busy={state === "loading"}
        role={canOpen ? "button" : undefined}
        tabIndex={canOpen ? 0 : undefined}
        onClick={openPopup}
        onKeyDown={handleKeyDown}
        onContextMenu={(event) => event.preventDefault()}
        onDragStart={(event) => event.preventDefault()}
        title={canOpen ? "Open larger CV preview" : undefined}
      >
        {state === "loading" ? <span className="pdf-render-note">Preparing vector preview</span> : null}
        {state === "error" ? <span className="pdf-render-note">Vector preview is not ready yet.</span> : null}
        {state === "ready" ? <SvgPages pages={pages} /> : null}
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

function SvgPages({ pages }: { pages: SvgPreviewPage[] }) {
  return (
    <div
      className="svg-page-scroll cv-preview-protected"
      aria-label="CV SVG Preview"
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
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
  );
}
