import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell } from "../src/exports.ts";
test("CSV exports quote cells and neutralize formula prefixes even after whitespace", () => {
  assert.equal(csvCell("https://example.com/"), '"https://example.com/"');
  for (const input of [
    "=1+1",
    " +SUM(1,2)",
    '\t=HYPERLINK("x")',
    "\n@SUM(1)",
    "-2+3",
  ])
    assert(csvCell(input).startsWith("\"'"));
  assert.equal(csvCell('a "quote"'), '"a ""quote"""');
});
