/**
 * useGapZoom — bidirectional zoom/pan hook for the Gap chart.
 *
 * Manages a 2D affine transform (per-axis scale + translate) and derives
 * visible xDomain/yDomain so GapChart can re-scale its axes without modifying
 * the SVG transform directly.
 *
 * Interaction model:
 *   • Wheel   — zoom both axes around the cursor position (clamped to extent).
 *   • Drag    — pointer-capture pan; works even if cursor leaves the element.
 *   • reset() — restore identity transform.
 *   • disabled — seam for Task 9 play mode: no interaction when true.
 *
 * Math overview
 * ─────────────
 * The transform represents a pixel-space zoom of the INNER plot area [0, iw] × [0, ih].
 * A point at original pixel px appears at screen position  px * scaleX + translateX.
 * The screen shows original pixels in the range:
 *   x: [ -translateX/scaleX,  (iw − translateX)/scaleX ]
 *   y: [ -translateY/scaleY,  (ih − translateY)/scaleY ]
 *
 * Converting original pixels back to domain values:
 *   xDomain: linear interpolation over [xMin, xMax] using fraction (px/iw).
 *   yDomain: INVERTED axis — pixel 0 = yMax, pixel ih = yMin.
 *     pxToY(py) = yMin + (1 − py/ih) × (yMax − yMin)
 *
 * Clamping: translateX ∈ [iw*(1−scaleX), 0] keeps the window inside full extent.
 *
 * @param {object}          params
 * @param {[Date,Date]}     params.xDomainFull   full x extent (Date objects)
 * @param {[number,number]} params.yDomainFull   full y extent [min, max]
 * @param {number}          params.innerWidth    plot pixel width  (without margins)
 * @param {number}          params.innerHeight   plot pixel height (without margins)
 * @param {boolean}         [params.disabled]    suspend all interaction (play mode)
 *
 * @returns {{ xDomain, yDomain, bind, reset, isZoomed, isDragging }}
 *   bind: { onWheel, onPointerDown, onPointerMove, onPointerUp }
 *   Spread `bind` onto the interaction surface of GapChart.
 *   Attach `onWheel` via addEventListener({passive:false}) for scroll prevention.
 */
import { useState, useCallback, useRef, useMemo } from 'react';

const IDENTITY = Object.freeze({ scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 });
const ZOOM_SPEED = 0.15;  // fraction of scale per wheel tick
const SCALE_MAX = 50;     // max zoom-in factor

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Clamp translateX so the visible window stays within [0, iw] in original space. */
function clampTx(tx, sx, iw) {
  return Math.min(0, Math.max(iw * (1 - sx), tx));
}

/** Clamp translateY so the visible window stays within [0, ih] in original space. */
function clampTy(ty, sy, ih) {
  return Math.min(0, Math.max(ih * (1 - sy), ty));
}

/**
 * Derive visible domains from the current transform and the full data extent.
 * Returns { xDomain: [Date, Date], yDomain: [number, number] }.
 */
function deriveDomains({ transform, xDomainFull, yDomainFull, iw, ih }) {
  const { scaleX: sx, scaleY: sy, translateX: tx, translateY: ty } = transform;

  // ── X domain (linear pixel space) ─────────────────────────────────────────
  const xMs0 = xDomainFull[0].getTime();
  const xMs1 = xDomainFull[1].getTime();
  const xRange = xMs1 - xMs0;
  const xPx0 = -tx / sx;                     // original pixel at screen left
  const xPx1 = (iw - tx) / sx;              // original pixel at screen right
  const visXMin = new Date(Math.max(xMs0, xMs0 + (xPx0 / iw) * xRange));
  const visXMax = new Date(Math.min(xMs1, xMs0 + (xPx1 / iw) * xRange));

  // ── Y domain (inverted axis: pixel 0 = yMax, pixel ih = yMin) ─────────────
  const [yMin, yMax] = yDomainFull;
  const yRange = yMax - yMin;
  const yPx0 = -ty / sy;                     // original pixel at screen top
  const yPx1 = (ih - ty) / sy;              // original pixel at screen bottom
  // pxToY(py) = yMin + (1 − py/ih) × yRange
  const visYMax = Math.min(yMax, yMin + (1 - yPx0 / ih) * yRange);
  const visYMin = Math.max(yMin, yMin + (1 - yPx1 / ih) * yRange);

  return {
    xDomain: [visXMin, visXMax],
    yDomain: [visYMin, visYMax],
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGapZoom({
  xDomainFull,
  yDomainFull,
  innerWidth,
  innerHeight,
  disabled = false,
}) {
  const [transform, setTransform] = useState({ ...IDENTITY });
  const [isDragging, setIsDragging] = useState(false);

  // Drag state tracked in a ref so handlers don't re-close over stale state.
  const drag = useRef(null); // { startClientX, startClientY, startTx, startTy }

  // ── Derived visible domains ───────────────────────────────────────────────
  const { xDomain, yDomain } = useMemo(() => {
    const iw = innerWidth;
    const ih = innerHeight;
    if (!iw || !ih || !xDomainFull || !yDomainFull) {
      return {
        xDomain: xDomainFull ?? [new Date(), new Date()],
        yDomain: yDomainFull ?? [0, 10],
      };
    }
    return deriveDomains({ transform, xDomainFull, yDomainFull, iw, ih });
  }, [transform, xDomainFull, yDomainFull, innerWidth, innerHeight]);

  const isZoomed =
    transform.scaleX !== 1 ||
    transform.scaleY !== 1 ||
    transform.translateX !== 0 ||
    transform.translateY !== 0;

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setTransform({ ...IDENTITY });
    drag.current = null;
    setIsDragging(false);
  }, []);

  // ── Wheel — zoom both axes around the cursor ──────────────────────────────
  // Designed to be attached via addEventListener({ passive: false }) so that
  // event.preventDefault() reliably suppresses page scroll during zoom.
  // The handler receives the native (or synthetic) WheelEvent; currentTarget
  // must be the interaction surface element (inner plot rect) so that
  // getBoundingClientRect() yields the plot coordinate origin.
  const onWheel = useCallback(
    (event) => {
      if (disabled) return;
      event.preventDefault();

      const rect = event.currentTarget.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const dir = event.deltaY < 0 ? 1 : -1;
      const factor = 1 + dir * ZOOM_SPEED;

      setTransform((prev) => {
        const newSX = Math.max(1, Math.min(SCALE_MAX, prev.scaleX * factor));
        const newSY = Math.max(1, Math.min(SCALE_MAX, prev.scaleY * factor));

        // Keep the pixel under the cursor fixed after scaling.
        // Before: origX = (mouseX − prev.tx) / prev.sx
        // After:  origX × newSX + newTx = mouseX  →  newTx = mouseX − origX × newSX
        const origX = (mouseX - prev.translateX) / prev.scaleX;
        const origY = (mouseY - prev.translateY) / prev.scaleY;
        const newTx = clampTx(mouseX - origX * newSX, newSX, innerWidth);
        const newTy = clampTy(mouseY - origY * newSY, newSY, innerHeight);

        return { scaleX: newSX, scaleY: newSY, translateX: newTx, translateY: newTy };
      });
    },
    [disabled, innerWidth, innerHeight],
  );

  // ── Drag — pan with pointer capture ──────────────────────────────────────
  const onPointerDown = useCallback(
    (event) => {
      if (disabled) return;
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {}
      drag.current = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        startTx: null, // filled lazily on first move
        startTy: null,
      };
      setIsDragging(true);
    },
    [disabled],
  );

  const onPointerMove = useCallback(
    (event) => {
      if (!drag.current || disabled) return;
      setTransform((prev) => {
        // Capture start translate on first move frame.
        if (drag.current.startTx === null) {
          drag.current.startTx = prev.translateX;
          drag.current.startTy = prev.translateY;
        }
        const dx = event.clientX - drag.current.startClientX;
        const dy = event.clientY - drag.current.startClientY;
        const tx = clampTx(drag.current.startTx + dx, prev.scaleX, innerWidth);
        const ty = clampTy(drag.current.startTy + dy, prev.scaleY, innerHeight);
        return { ...prev, translateX: tx, translateY: ty };
      });
    },
    [disabled, innerWidth, innerHeight],
  );

  const onPointerUp = useCallback((event) => {
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch (_) {}
    drag.current = null;
    setIsDragging(false);
  }, []);

  // ── Bind object ──────────────────────────────────────────────────────────
  // When disabled, return an empty object so GapChart renders with no handlers.
  const bind = useMemo(
    () =>
      disabled
        ? {}
        : { onWheel, onPointerDown, onPointerMove, onPointerUp },
    [disabled, onWheel, onPointerDown, onPointerMove, onPointerUp],
  );

  return { xDomain, yDomain, bind, reset, isZoomed, isDragging };
}
