"use client";

import type { MouseEvent } from "react";
import { Volume2 } from "lucide-react";

/**
 * The big round gold audio button of listen-like game screens (DESIGN.md V3).
 * Its rings expand slowly while the learner listens and stop as soon as they
 * type (`ringing`), so nothing moves during typing. `onMouseDown` lets the
 * game keep focus in the answer field.
 */
export function AudioButton({
  label,
  onPlay,
  ringing,
  size = "lg",
  onMouseDown,
  disabled,
}: {
  label: string;
  onPlay: () => void;
  ringing: boolean;
  size?: "lg" | "sm";
  onMouseDown?: ((e: MouseEvent) => void) | undefined;
  disabled?: boolean | undefined;
}) {
  const box = size === "lg" ? "size-24 sm:size-28" : "size-12";
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onPlay}
      onMouseDown={onMouseDown}
      disabled={disabled}
      data-ringing={ringing && !disabled}
      className={`audio-rings relative grid shrink-0 place-items-center rounded-full bg-gold text-on-gold transition-[background-color,transform] duration-150 hover:bg-gold-hover active:scale-[0.97] disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold ${box}`}
    >
      <Volume2 className={size === "lg" ? "size-9 sm:size-10" : "size-5"} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
