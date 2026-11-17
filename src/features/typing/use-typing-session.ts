"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyInput, createEngine, isFinished, type EngineState, type TypingInput } from "@/domain/typing/engine";
import { computeMetrics, type Metrics } from "@/domain/typing/metrics";

export type SessionStatus = "idle" | "running" | "finished";

export interface FinishedSession {
  readonly state: EngineState;
  readonly metrics: Metrics;
  readonly endAt: number;
}

interface Options {
  readonly target: string;
  /** null = untimed (finish at the end of the text). */
  readonly durationSec: number | null;
  readonly onFinish: (session: FinishedSession) => void;
}

const LIVE_TICK_MS = 250;

/**
 * Holds the pure typing engine and re-renders once per keystroke. Live metrics
 * are recomputed at 4 Hz (not per keystroke) so input latency stays minimal.
 * One session per text: callers give the component a new `key` for a new text.
 */
export function useTypingSession({ target, durationSec, onFinish }: Options) {
  const [snapshot, setSnapshot] = useState<EngineState>(() => createEngine(target));
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [live, setLive] = useState<Metrics>(() => computeMetrics(createEngine(target), 0));
  const [remaining, setRemaining] = useState<number | null>(durationSec);
  const engineRef = useRef<EngineState>(snapshot);
  const statusRef = useRef<SessionStatus>("idle");
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  });

  const reset = useCallback(() => {
    const fresh = createEngine(target);
    engineRef.current = fresh;
    statusRef.current = "idle";
    setSnapshot(fresh);
    setStatus("idle");
    setLive(computeMetrics(fresh, 0));
    setRemaining(durationSec);
  }, [target, durationSec]);

  const finish = useCallback((endAt: number) => {
    if (statusRef.current === "finished") return;
    statusRef.current = "finished";
    setStatus("finished");
    const state = engineRef.current;
    const metrics = computeMetrics(state, endAt);
    setLive(metrics);
    onFinishRef.current({ state, metrics, endAt });
  }, []);

  const dispatch = useCallback(
    (input: TypingInput) => {
      if (statusRef.current === "finished") return;
      const next = applyInput(engineRef.current, input);
      if (next === engineRef.current) return;
      engineRef.current = next;
      setSnapshot(next);
      if (statusRef.current === "idle" && next.startedAt !== null) {
        statusRef.current = "running";
        setStatus("running");
      }
      if (isFinished(next)) finish(next.lastAt ?? input.t);
    },
    [finish],
  );

  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(() => {
      const t = performance.now();
      const state = engineRef.current;
      const start = state.startedAt;
      if (start === null) return;
      if (durationSec !== null && t - start >= durationSec * 1000) {
        setRemaining(0);
        finish(start + durationSec * 1000);
        return;
      }
      setLive(computeMetrics(state, t));
      if (durationSec !== null) setRemaining(Math.max(0, Math.ceil(durationSec - (t - start) / 1000)));
    }, LIVE_TICK_MS);
    return () => window.clearInterval(id);
  }, [status, durationSec, finish]);

  return { snapshot, status, live, remaining, dispatch, reset };
}
