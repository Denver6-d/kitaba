import Link from "next/link";
import { tatoebaUrl, type TatoebaCredit } from "@/data/play-word";

/**
 * The small attribution line for a Tatoeba sentence (CC BY 2.0 FR requires the
 * author's name and a link): "Tatoeba #1276 · CK", linked to the sentence.
 * The licence itself is named on /credits, which is linked from the menu.
 */
export function TatoebaCreditLine({ credit, className = "" }: { credit: TatoebaCredit; className?: string }) {
  return (
    <p dir="ltr" lang="en" className={`text-xs text-ink-soft ${className}`}>
      <a href={tatoebaUrl(credit.id)} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
        Tatoeba #{credit.id} · {credit.author}
      </a>{" "}
      ·{" "}
      <Link href="/credits" className="underline-offset-2 hover:underline">
        CC BY 2.0 FR
      </Link>
    </p>
  );
}
