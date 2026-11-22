import { describe, expect, it } from "vitest";
import { CSV_BOM, csvCell, neutraliseFormula, toCsv } from "@/lib/csv";

/** Splits a file into rows of raw cell text, honouring quotes (enough for these tests). */
function parse(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const body = csv.startsWith(CSV_BOM) ? csv.slice(1) : csv;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" && body[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
    } else cell += ch;
  }
  return rows;
}

describe("csvCell: quoting and escaping (RFC 4180)", () => {
  it("leaves plain text and numbers unquoted", () => {
    expect(csvCell("hello")).toBe("hello");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(0.5)).toBe("0.5");
  });

  it("writes null, undefined and non-finite numbers as empty cells", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(Number.NaN)).toBe("");
    expect(csvCell(Number.POSITIVE_INFINITY)).toBe("");
  });

  it("quotes commas, quotes, newlines and carriage returns, doubling inner quotes", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line 1\nline 2")).toBe('"line 1\nline 2"');
    expect(csvCell("a\r\nb")).toBe('"a\r\nb"');
  });

  it("quotes leading or trailing spaces so they survive", () => {
    expect(csvCell(" padded ")).toBe('" padded "');
  });

  it("writes numbers with Western digits", () => {
    expect(csvCell(1234567)).toBe("1234567");
    expect(csvCell(1234567)).not.toMatch(/[٠-٩۰-۹]/);
  });
});

describe("formula injection is neutralised", () => {
  for (const start of ["=", "+", "-", "@", "\t", "\r"]) {
    it(`a cell starting with ${JSON.stringify(start)} gets a leading apostrophe`, () => {
      expect(neutraliseFormula(`${start}1+1`)).toBe(`'${start}1+1`);
      expect(csvCell(`${start}SUM(A1)`).replace(/^"|"$/g, "").startsWith("'")).toBe(true);
    });
  }

  it("catches the classic payloads", () => {
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csvCell("@SUM(1+1)*cmd|' /C calc'!A0")).toBe("'@SUM(1+1)*cmd|' /C calc'!A0");
    expect(csvCell("-2+3")).toBe("'-2+3");
  });

  it("checks numbers too: a negative number is written as text", () => {
    expect(csvCell(-5)).toBe("'-5");
  });

  it("leaves the characters alone when they are not first", () => {
    expect(neutraliseFormula("a=b")).toBe("a=b");
    expect(neutraliseFormula("e-mail")).toBe("e-mail");
    expect(neutraliseFormula("")).toBe("");
  });
});

describe("toCsv", () => {
  it("starts with a UTF-8 byte order mark so Excel reads Arabic", async () => {
    const csv = toCsv({ header: ["a"], rows: [] });
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    const bytes = new Uint8Array(await new Blob([csv]).arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("keeps Arabic text intact (UTF-8 round trip)", async () => {
    const csv = toCsv({ header: ["الكلمة", "المعنى"], rows: [["because", "لأنّ، بسبب"]] });
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(await new Blob([csv]).arrayBuffer());
    expect(text).toBe(csv);
    expect(parse(csv)).toEqual([
      ["الكلمة", "المعنى"],
      ["because", "لأنّ، بسبب"],
    ]);
  });

  it("an empty table is just the header row", () => {
    expect(toCsv({ header: ["x", "y"], rows: [] })).toBe(`${CSV_BOM}x,y\r\n`);
  });

  it("an empty header and no rows is still a valid (BOM-only) file", () => {
    expect(toCsv({ header: [], rows: [] })).toBe(`${CSV_BOM}\r\n`);
  });

  it("uses CRLF between rows and survives a round trip with awkward cells", () => {
    const rows = [["a,b", 'q"q', "multi\nline", "=1+1", 7]];
    const csv = toCsv({ header: ["h1", "h2", "h3", "h4", "h5"], rows });
    expect(csv.split("\r\n")).toHaveLength(3);
    expect(parse(csv)[1]).toEqual(["a,b", 'q"q', "multi\nline", "'=1+1", "7"]);
  });
});
