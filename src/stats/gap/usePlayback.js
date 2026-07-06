/**
 * usePlayback — rAF-based stepper for the Gap chart animate mode.
 *
 * Advances `index` from 0 to count-1 at a readable cadence (~400 ms/step)
 * using requestAnimationFrame + timestamp accumulation (not setInterval),
 * so the animation stays accurate even under frame-rate jitter, and the
 * rAF handle is always cancelled on unmount / pause / seek.
 *
 * @param {number} count  Total number of daily snapshots (series[0].data.length).
 * @returns {{ index, playing, play, pause, toggle, seek, reset }}
 */
import { useState, useRef, useCallback, useEffect } from 'react';

const STEP_MS = 400; // advance one snapshot every ~400 ms

export function usePlayback(count) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Mutable state for the rAF loop — avoids stale closure captures.
  // stateRef.current is the single source of truth for the rAF loop;
  // React state (index / playing) is kept in sync for re-renders.
  const stateRef = useRef({ playing: false, index: 0, count });
  const rafRef = useRef(null);
  const lastTsRef = useRef(null);

  // Keep count in stateRef current.
  useEffect(() => {
    stateRef.current.count = count;
  }, [count]);

  // Cancel rAF on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // ── rAF loop ─────────────────────────────────────────────────────────────
  // Stable function: deps are only refs + stable setters, so this never
  // changes identity and can safely self-reschedule.
  const loop = useCallback((ts) => {
    if (!stateRef.current.playing) return;

    // Initialise timestamp on the first frame.
    if (lastTsRef.current === null) lastTsRef.current = ts;

    const elapsed = ts - lastTsRef.current;

    if (elapsed >= STEP_MS) {
      lastTsRef.current = ts;
      const next = stateRef.current.index + 1;

      if (next >= stateRef.current.count) {
        // Reached the end — stop and leave index at count-1.
        stateRef.current.playing = false;
        setPlaying(false);
        return; // do NOT reschedule
      }

      stateRef.current.index = next;
      setIndex(next);
    }

    rafRef.current = requestAnimationFrame(loop);
  }, []); // intentionally empty — only reads refs / stable setters

  // ── Controls ─────────────────────────────────────────────────────────────

  const _cancelRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const play = useCallback(() => {
    if (stateRef.current.count <= 1) return;
    _cancelRaf();

    // If already at the end, restart from 0.
    const startIdx =
      stateRef.current.index >= stateRef.current.count - 1 ? 0 : stateRef.current.index;

    stateRef.current.index = startIdx;
    stateRef.current.playing = true;
    setIndex(startIdx);
    setPlaying(true);
    lastTsRef.current = null;
    rafRef.current = requestAnimationFrame(loop);
  }, [_cancelRaf, loop]);

  const pause = useCallback(() => {
    stateRef.current.playing = false;
    setPlaying(false);
    _cancelRaf();
  }, [_cancelRaf]);

  const toggle = useCallback(() => {
    if (stateRef.current.playing) {
      pause();
    } else {
      play();
    }
  }, [pause, play]);

  /** Seek to index i, pausing playback (manual seek always pauses). */
  const seek = useCallback(
    (i) => {
      stateRef.current.playing = false;
      setPlaying(false);
      _cancelRaf();
      const clamped = Math.max(0, Math.min(stateRef.current.count - 1, i));
      stateRef.current.index = clamped;
      setIndex(clamped);
    },
    [_cancelRaf],
  );

  /** Reset to index 0, paused. */
  const reset = useCallback(() => {
    stateRef.current.playing = false;
    setPlaying(false);
    _cancelRaf();
    stateRef.current.index = 0;
    setIndex(0);
  }, [_cancelRaf]);

  return { index, playing, play, pause, toggle, seek, reset };
}
