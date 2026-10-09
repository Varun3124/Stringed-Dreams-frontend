import { useRef, useState, useCallback } from 'react';

const MAX_STEPS = 100;
// Repeated edits to the same field within this window (e.g. typing a number) merge into one step
const MERGE_WINDOW_MS = 2000;

/*
 * Undo/redo history for a page's own (optimistic) edits.
 *
 * `record({ label, undo, redo, mergeKey? })` adds a step. `undo`/`redo` re-run the page's
 * operations; anything those record while replaying is ignored. A step that can't run returns
 * false, or a string saying why, and is dropped.
 *
 * `group(label, fn)` turns everything `fn` records into a single step.
 */
const useUndoHistory = () => {
  const stacksRef = useRef({ undo: [], redo: [] });
  const replayingRef = useRef(false);
  const groupRef = useRef(null);
  const [labels, setLabels] = useState({ undo: null, redo: null });

  const syncLabels = useCallback(() => {
    const { undo, redo } = stacksRef.current;
    setLabels({
      undo: undo.length > 0 ? undo[undo.length - 1].label : null,
      redo: redo.length > 0 ? redo[redo.length - 1].label : null
    });
  }, []);

  const record = useCallback((step) => {
    if (replayingRef.current) return;
    if (groupRef.current) {
      groupRef.current.push(step);
      return;
    }
    const { undo } = stacksRef.current;
    const last = undo[undo.length - 1];
    const now = Date.now();
    if (step.mergeKey && last?.mergeKey === step.mergeKey && now - last.at < MERGE_WINDOW_MS) {
      // Keep the first step's undo and take the newest redo
      undo[undo.length - 1] = { ...last, redo: step.redo, at: now };
    } else {
      undo.push({ ...step, at: now });
      if (undo.length > MAX_STEPS) undo.shift();
    }
    stacksRef.current.redo = [];
    syncLabels();
  }, [syncLabels]);

  const group = useCallback((label, fn) => {
    if (replayingRef.current || groupRef.current) return fn();
    groupRef.current = [];
    try {
      return fn();
    } finally {
      const steps = groupRef.current;
      groupRef.current = null;
      if (steps.length === 1) {
        record({ ...steps[0], label });
      } else if (steps.length > 1) {
        record({
          label,
          undo: () => { [...steps].reverse().forEach((step) => step.undo()); },
          redo: () => { steps.forEach((step) => step.redo()); }
        });
      }
    }
  }, [record]);

  // Returns { step, ok, reason } for the step that ran, or null when there was nothing to run
  const replay = useCallback((from, to, action) => {
    const stack = stacksRef.current[from];
    const step = stack.pop();
    if (!step) return null;
    replayingRef.current = true;
    let result;
    try {
      result = step[action]();
    } finally {
      replayingRef.current = false;
    }
    const ok = result !== false && typeof result !== 'string';
    if (ok) stacksRef.current[to].push(step);
    syncLabels();
    return { step, ok, reason: typeof result === 'string' ? result : null };
  }, [syncLabels]);

  const undo = useCallback(() => replay('undo', 'redo', 'undo'), [replay]);
  const redo = useCallback(() => replay('redo', 'undo', 'redo'), [replay]);

  return { record, group, undo, redo, undoLabel: labels.undo, redoLabel: labels.redo };
};

export default useUndoHistory;
