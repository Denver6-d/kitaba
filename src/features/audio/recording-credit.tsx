import Link from "next/link";
import type { RecordingCredit } from "@/data/audio-schema";

/**
 * The small attribution line for a human recording from Wikimedia Commons
 * (CC BY and CC BY-SA require the author, the licence and a link): "Audio:
 * Dvortygirl (Wikimedia Commons) · CC BY-SA 3.0". Every file is also listed on
 * /credits with its source and licence.
 */
export function RecordingCreditLine({ credit, className = "", tone = "text-fg-2" }: { credit: RecordingCredit; className?: string; tone?: string }) {
  const link = "underline-offset-2 hover:underline";
  return (
    <p dir="ltr" lang="en" className={`text-xs ${tone} ${className}`}>
      Audio:{" "}
      <a href={credit.page} target="_blank" rel="noopener noreferrer" className={link}>
        {credit.author} (Wikimedia Commons)
      </a>{" "}
      ·{" "}
      {credit.licenseUrl ? (
        <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer license" className={link}>
          {credit.license}
        </a>
      ) : (
        <Link href="/credits" className={link}>
          {credit.license}
        </Link>
      )}
    </p>
  );
}
