import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
test("WordPress companion parses as PHP", () => {
  const Engine = require("php-parser");
  const parser = new Engine({
    parser: { suppressErrors: false },
    ast: { withPositions: true },
  });
  const source = readFileSync(
    new URL(
      "../wordpress/local-seo-repairs/local-seo-repairs.php",
      import.meta.url,
    ),
    "utf8",
  );
  const ast = parser.parseCode(source, "local-seo-repairs.php");
  assert.equal(ast.kind, "program");
  assert(ast.children.length > 0);
});
