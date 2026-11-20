"use client";

import { forwardRef } from "react";

/**
 * The English answer area for whole texts. Autocorrect, autocapitalise and the
 * browser's own spell checker are off, so the browser never fixes a mistake
 * for the learner (SPEC 7.5). On focus it scrolls itself into view above the
 * phone keyboard (the viewport resizes with the keyboard, see layout.tsx).
 */
export const WritingTextarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }>(function WritingTextarea(
  { label, className = "", id, ...props },
  ref,
) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-medium">
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        dir="ltr"
        lang="en"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        rows={6}
        onFocus={(e) => {
          const el = e.currentTarget;
          window.setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
        }}
        className={`block min-h-44 w-full resize-y rounded-xl border-2 border-line-strong bg-canvas p-4 font-word text-lg leading-relaxed focus:border-gold sm:min-h-56 sm:text-xl ${className}`}
        {...props}
      />
    </div>
  );
});
