import { useState } from "react";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { petOf } from "@/mock/codebook";
import { tensionHeadline } from "@/state/signals";
import {
  band,
  denominator,
  liveExcerpts,
  peopleOf,
  questionOf,
  themeCodes,
  themePeople,
  type Basis,
  type CodebookDoc,
} from "@/state/codebook";
import { mmss } from "../review/reviewUi";

type Cell = {
  value: string | number;
  fontWeight?: "bold";
  wrap?: boolean;
} | null;

const head = (labels: string[]): Cell[] =>
  labels.map((value) => ({ value, fontWeight: "bold" as const }));
const text = (value: string | number | undefined): Cell =>
  value === undefined || value === ""
    ? null
    : { value, wrap: typeof value === "string" && value.length > 40 };

/** Four sheets: codes, every quote, themes, and the change log. Statuses are columns, so the file works at any point. */
export function codebookSheets(doc: CodebookDoc, basis: Basis) {
  const themeOf = new Map(
    doc.themes.flatMap((t) =>
      themeCodes(doc, t).map((c) => [c.id, t.name] as const),
    ),
  );
  const nameOf = new Map(doc.codes.map((c) => [c.id, c.name]));
  const codes = [
    head([
      "Code",
      "Status",
      "Type",
      "Guide question",
      "Definition",
      "People",
      "Asked",
      "Confidence",
      "Theme",
      "Merged into",
    ]),
    ...doc.codes.map((c) => [
      text(c.name),
      text(c.status),
      text(c.isNew ? "New code" : "From the guide"),
      text(questionOf(c.questionId).label),
      text(c.definition),
      text(c.status === "Merged" ? "" : peopleOf(c, basis).size),
      text(denominator(c, basis)),
      text(`${band(c.confidence)} (${c.confidence.toFixed(2)})`),
      text(themeOf.get(c.id)),
      text(c.mergedInto ? nameOf.get(c.mergedInto) : ""),
    ]),
  ];
  const quotes = [
    head([
      "Code",
      "Code status",
      "Participant",
      "Pet",
      "Session",
      "Time",
      "Quote",
      "Match score",
      "Transcript",
    ]),
    ...doc.codes.flatMap((c) =>
      liveExcerpts(c, basis).map((e) => [
        text(c.name),
        text(c.status),
        text(e.participantId),
        text(petOf(e.participantId)),
        text(e.sessionId),
        text(mmss(e.atSec)),
        text(e.text),
        text(Number(e.confidence.toFixed(2))),
        text(e.corrected ? "Corrected" : "Raw"),
      ]),
    ),
  ];
  const themes = [
    head([
      "Theme",
      "What it means",
      "People",
      "Of",
      "Codes",
      "Created by",
      "Created",
    ]),
    ...doc.themes.map((t) => {
      // A theme made from a tension counts the tension's own finding, as on the Themes tab.
      const h = t.tensionId
        ? tensionHeadline(doc, basis, t.tensionId)
        : undefined;
      return [
        text(t.name),
        text(t.definition),
        text(h ? h.n : themePeople(doc, t, basis).size),
        text(h ? h.of : basis.participants.size),
        text(
          themeCodes(doc, t)
            .map((c) => c.name)
            .join("; "),
        ),
        text(t.by),
        text(t.at),
      ];
    }),
  ];
  const log = [
    head(["When", "Who", "Kind", "Code or theme", "Change", "Detail", "Why"]),
    ...doc.log.map((l) => [
      text(l.at),
      text(l.by),
      text(l.target.kind),
      text(l.target.name),
      text(l.action),
      text(l.detail),
      text(l.why),
    ]),
  ];
  return [
    {
      data: codes,
      sheet: "Codes",
      columns: [36, 12, 14, 30, 50, 8, 8, 14, 28, 28].map((width) => ({
        width,
      })),
      stickyRowsCount: 1,
    },
    {
      data: quotes,
      sheet: "Quotes",
      columns: [32, 12, 10, 6, 11, 7, 70, 11, 11].map((width) => ({ width })),
      stickyRowsCount: 1,
    },
    {
      data: themes,
      sheet: "Themes",
      columns: [30, 50, 8, 6, 60, 14, 24].map((width) => ({ width })),
      stickyRowsCount: 1,
    },
    {
      data: log,
      sheet: "Change log",
      columns: [24, 14, 9, 32, 22, 50, 50].map((width) => ({ width })),
      stickyRowsCount: 1,
    },
  ];
}

export function ExportButton({
  doc,
  basis,
  studyName,
}: {
  doc: CodebookDoc;
  basis: Basis;
  studyName: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      loading={busy}
      data-testid="export-excel"
      onClick={async () => {
        setBusy(true);
        try {
          const { default: write } = await import("write-excel-file/browser");
          const day = new Date().toISOString().slice(0, 10);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await write(codebookSheets(doc, basis) as any).toFile(
            `${studyName} - codebook - ${day}.xlsx`,
          );
          toast("Codebook exported to Excel");
        } catch {
          toast("The export didn’t work. Try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      Export to Excel
    </Button>
  );
}
