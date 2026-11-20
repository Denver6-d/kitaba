/**
 * The typed word, one letter per box (DESIGN.md V3). A box appears and lights
 * up as its letter is typed; an empty dashed box shows where the next letter
 * goes. It mirrors the labelled input below it and is hidden from assistive
 * technology, which reads the input. Boxes appear for typed letters only, so
 * they never reveal the length of the word being tested (DECISIONS R12). The
 * game hides them once the answer is checked ("You wrote" takes over).
 */
const BOX = "h-[clamp(2.75rem,11vw,3.75rem)] w-[clamp(2rem,8.4vw,2.85rem)] rounded-xl";

export function LetterBoxes({ value }: { value: string }) {
  return (
    <div aria-hidden="true" dir="ltr" lang="en" className="flex min-h-[clamp(2.75rem,11vw,3.75rem)] flex-wrap justify-center gap-1.5 sm:gap-2">
      {[...value].map((ch, i) => (
        <span
          // Keyed by position: only a newly typed box mounts, so only it animates.
          key={i}
          className={`letter-in grid place-items-center border border-line-strong bg-raised font-word text-[clamp(1.35rem,5.6vw,2rem)] leading-none ${BOX}`}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
      <span className={`border border-dashed border-line-strong/70 ${BOX}`} />
    </div>
  );
}
