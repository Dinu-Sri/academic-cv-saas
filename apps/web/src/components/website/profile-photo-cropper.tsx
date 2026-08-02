"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ScanFace, X } from "lucide-react";
import { PROFILE_IMAGE_OUTPUT_SIZE } from "@/lib/website/profile-image-constants";

type Props = {
  file: File;
  onCancel: () => void;
  onSave: (webpBlob: Blob) => Promise<void>;
};

/**
 * Facebook-style square crop: pan + zoom, optional browser FaceDetector assist,
 * export cropped square as WebP only (original never uploaded).
 */
export function ProfilePhotoCropper({ file, onCancel, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [minZoom, setMinZoom] = useState(1);
  const [faceHint, setFaceHint] = useState("");

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = PROFILE_IMAGE_OUTPUT_SIZE;
    canvas.width = size;
    canvas.height = size;
    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(0, 0, size, size);

    const scale = (size / Math.min(image.naturalWidth, image.naturalHeight)) * zoom;
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;
    const dx = (size - drawW) / 2 + offset.x;
    const dy = (size - drawH) / 2 + offset.y;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, dx, dy, drawW, drawH);

    // Soft vignette ring for crop edge preview
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }, [offset.x, offset.y, zoom]);

  useEffect(() => {
    let cancelled = false;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      imageRef.current = image;
      // min zoom = cover square fully
      const base = 1;
      setMinZoom(base);
      setZoom(base);
      setOffset({ x: 0, y: 0 });
      setReady(true);
      void tryFaceCenter(image).then((centered) => {
        if (cancelled || !centered) return;
        setOffset(centered.offset);
        setZoom(Math.max(base, centered.zoom));
        setFaceHint("Face detected — adjust if needed, then save.");
      });
    };
    image.onerror = () => {
      if (!cancelled) setError("Could not load that image.");
    };
    image.src = url;
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    if (ready) draw();
  }, [ready, draw]);

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    setOffset({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy });
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    setError("");
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.84));
      if (!blob) throw new Error("Could not export WebP. Try another browser or image.");
      await onSave(blob);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save photo.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop profile-photo-modal" role="presentation" onMouseDown={onCancel}>
      <section
        className="profile-photo-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-photo-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="profile-photo-dialog-head">
          <div>
            <h2 id="profile-photo-title">Adjust profile photo</h2>
            <p>Drag to position, zoom to crop. We save only the optimized WebP — the original is not kept.</p>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="profile-photo-stage">
          <canvas
            ref={canvasRef}
            className="profile-photo-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>

        <label className="profile-photo-zoom">
          <span>Zoom</span>
          <input
            type="range"
            min={minZoom}
            max={Math.max(minZoom + 1.5, 3)}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>

        {faceHint ? (
          <p className="profile-photo-hint">
            <ScanFace size={14} /> {faceHint}
          </p>
        ) : (
          <p className="profile-photo-hint muted-text">Tip: center your face in the circle before saving.</p>
        )}

        {error ? <p className="form-error">{error}</p> : null}

        <div className="profile-photo-actions">
          <button type="button" className="secondary-action" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="primary-action" onClick={() => void handleSave()} disabled={!ready || saving}>
            {saving ? <Loader2 className="spin-icon" size={16} /> : null}
            {saving ? "Saving…" : "Save photo"}
          </button>
        </div>
      </section>
    </div>
  );
}

type FaceDetectorLike = {
  detect: (image: CanvasImageSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
};

async function tryFaceCenter(image: HTMLImageElement): Promise<{ offset: { x: number; y: number }; zoom: number } | null> {
  try {
    // Chrome Shape Detection API when available (optional assist).
    const Detector = (window as unknown as { FaceDetector?: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike }).FaceDetector;
    if (!Detector) return null;
    const detector = new Detector({ fastMode: true, maxDetectedFaces: 1 });
    const faces = await detector.detect(image);
    if (!faces.length) return null;
    const box = faces[0].boundingBox;
    const faceCx = box.x + box.width / 2;
    const faceCy = box.y + box.height / 2;
    const size = PROFILE_IMAGE_OUTPUT_SIZE;
    const cover = size / Math.min(image.naturalWidth, image.naturalHeight);
    // Slight zoom so face fills more of the frame.
    const zoom = Math.min(2.4, Math.max(1, (size * 0.55) / (Math.max(box.width, box.height) * cover)));
    const scale = cover * zoom;
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;
    const idealDx = size / 2 - faceCx * scale;
    const idealDy = size / 2 - faceCy * scale;
    // Convert absolute image draw origin into our offset model (centered base).
    const baseDx = (size - drawW) / 2;
    const baseDy = (size - drawH) / 2;
    return {
      zoom,
      offset: {
        x: idealDx - baseDx,
        y: idealDy - baseDy
      }
    };
  } catch {
    return null;
  }
}
