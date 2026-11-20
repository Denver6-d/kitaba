import { MomentLabel } from "@/components/ui/card";

/**
 * The mint "moment" card that explains the rule behind a mistake (DESIGN.md
 * V3): the rule's name, the rule in a sentence, a memory trick, and an example
 * sentence that uses the word.
 */
export function RuleCard({
  label,
  title,
  rule,
  trickLabel,
  trick,
  exampleLabel,
  example,
  footer,
}: {
  label: string;
  title: string;
  rule: string;
  trickLabel: string;
  trick: string;
  exampleLabel: string;
  example?: string | undefined;
  footer?: React.ReactNode;
}) {
  return (
    <section className="moment space-y-4 p-6 sm:p-7">
      <div className="space-y-1">
        <MomentLabel>{label}</MomentLabel>
        <h3 className="text-xl leading-snug font-medium text-on-mint">{title}</h3>
      </div>
      <p className="text-on-mint-2">{rule}</p>
      <p className="text-on-mint">
        <span className="font-medium">{trickLabel}: </span>
        {trick}
      </p>
      {example && (
        <p className="border-s-2 border-on-mint/20 ps-3 text-on-mint-2">
          <span className="sr-only">{exampleLabel}: </span>
          <span dir="ltr" lang="en" className="inline-block text-on-mint">
            {example}
          </span>
        </p>
      )}
      {footer}
    </section>
  );
}
