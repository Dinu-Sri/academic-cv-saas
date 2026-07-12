"use client";

import { useMemo, useRef, useState } from "react";
import type React from "react";
import { Move, X } from "lucide-react";

type PdfRenderState = "loading" | "ready" | "error";

export function PdfCanvasPreview({ sourceUrl, mode = "inline" }: { sourceUrl: string; mode?: "inline" | "modal" }) {
  const [state, setState] = useState<PdfRenderState>("loading");
  const [popupOpen, setPopupOpen] = useState(false);
  const [position, setPosition] = useState({ x: 110, y: 86 });
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const secureUrl = useMemo(() => {
    if (!sourceUrl) return "";
    const sep = sourceUrl.includes("#") ? "&" : "#";
    return `${sourceUrl}${sep}toolbar=0&navpanes=0`;
  }, [sourceUrl]);

  function handleIframeLoad() {
    setState("ready");
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        doc.addEventListener("contextmenu", (e) => e.preventDefault());
      }
    } catch {
      // cross-origin — contextmenu prevention not available
    }
  }

  function handleIframeError() {
    setState("error");
  }

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
        aria-busy={state === "loading"}
        role={canOpen ? "button" : undefined}
        tabIndex={canOpen ? 0 : undefined}
        onClick={openPopup}
        onKeyDown={handleKeyDown}
        title={canOpen ? "Open larger CV preview" : undefined}
        onContextMenu={(e) => e.preventDefault()}
      >
        {state === "loading" ? <span className="pdf-render-note">Loading PDF preview</span> : null}
        {state === "error" ? <span className="pdf-render-note">Could not show the PDF preview.</span> : null}
        <iframe
          ref={iframeRef}
          src={secureUrl}
          className={`pdf-iframe-preview ${state === "ready" ? "is-loaded" : ""}`}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          title="CV PDF Preview"
        />
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
