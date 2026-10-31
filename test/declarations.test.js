import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { findDocumentedDeclarations } from "../jsdoc/declarations.js";

const declOf = (source) => findDocumentedDeclarations(source)[0].declaration;

describe("findDocumentedDeclarations", () => {
  test("returns nothing when there are no doc comments", () => {
    assert.deepEqual(findDocumentedDeclarations("// hi\n/* plain */\nfunction f() {}"), []);
  });

  test("returns the comment text", () => {
    const [{ comment }] = findDocumentedDeclarations("/** Hello */\nfunction f() {}");
    assert.equal(comment, "/** Hello */");
  });

  test("describes function declarations", () => {
    assert.deepEqual(declOf("/** */\nasync function* f(a, b = 1) {}"), {
      kind: "function",
      name: "f",
      params: ["a", "b = 1"],
      async: true,
      generator: true,
    });
  });

  test("describes class declarations", () => {
    assert.deepEqual(declOf("/** */\nclass A extends B.C {}"), { kind: "class", name: "A", extends: "B.C" });
  });

  test("describes variables holding arrow functions", () => {
    assert.deepEqual(declOf("/** */\nconst f = async (x) => x;"), {
      kind: "function",
      name: "f",
      params: ["x"],
      async: true,
      generator: false,
      declarationKind: "const",
    });
  });

  test("describes plain variables", () => {
    assert.deepEqual(declOf("/** */\nlet x = 1;"), { kind: "variable", name: "x", declarationKind: "let" });
  });

  test("ignores destructuring declarations", () => {
    assert.equal(declOf("/** */\nconst { a } = b;"), null);
  });

  test("marks named and default exports", () => {
    assert.deepEqual(declOf("/** */\nexport function f() {}"), {
      kind: "function",
      name: "f",
      params: [],
      async: false,
      generator: false,
      exported: true,
      default: false,
    });
    assert.equal(declOf("/** */\nexport default class {}").default, true);
  });

  test("describes class members", () => {
    const source = `class A {
  /** */ constructor(a) {}
  /** */ static m() {}
  /** */ get g() { return 1; }
  /** */ #p = 1;
  /** */ [k]() {}
}`;
    const result = findDocumentedDeclarations(source).map((r) => r.declaration);
    assert.deepEqual(
      result.map(({ kind, name, static: s }) => [kind, name, s]),
      [
        ["constructor", "constructor", false],
        ["method", "m", true],
        ["get", "g", false],
        ["property", "#p", false],
        ["method", "[k]", false],
      ],
    );
  });

  test("describes object properties and methods", () => {
    const result = findDocumentedDeclarations(`const o = {
  /** */ a: 1,
  /** */ b() {},
  /** */ c: () => {},
};`).map((r) => r.declaration);
    assert.deepEqual(
      result.map(({ kind, name }) => [kind, name]),
      [
        ["property", "a"],
        ["method", "b"],
        ["method", "c"],
      ],
    );
  });

  test("describes member assignments", () => {
    assert.deepEqual(declOf("/** */\nmodule.exports.f = function (a) {};"), {
      kind: "function",
      name: "module.exports.f",
      params: ["a"],
      async: false,
      generator: false,
    });
  });

  test("skips non-doc comments between the doc comment and the code", () => {
    assert.equal(declOf("/** */\n// eslint-disable-next-line\n/* x */\nfunction f() {}").name, "f");
  });

  test("returns null declaration when nothing follows", () => {
    assert.equal(declOf("function f() {}\n/** trailing */"), null);
  });

  test("returns null declaration for unrecognised nodes", () => {
    assert.equal(declOf("/** */\nif (x) {}"), null);
  });

  test("falls back to script parsing (CommonJS)", () => {
    assert.equal(declOf("/** */\nfunction f() { return 1; }\nreturn f;").name, "f");
  });

  test("throws on invalid JavaScript", () => {
    assert.throws(() => findDocumentedDeclarations("/** */ function ("), SyntaxError);
  });
});
