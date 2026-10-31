import * as acorn from "acorn";
import { full } from "acorn-walk";

const FUNCTION_TYPES = new Set([
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

function parseJs(source, sourceType) {
  const comments = [];
  const commentEnds = new Map(); // start -> end of every comment, to skip over them
  const ast = acorn.parse(source, {
    ecmaVersion: "latest",
    sourceType,
    allowHashBang: true,
    allowReturnOutsideFunction: sourceType === "script",
    onComment(isBlock, text, start, end) {
      commentEnds.set(start, end);
      if (isBlock && text.startsWith("*")) {
        comments.push({ text: source.slice(start, end), end });
      }
    },
  });
  return { ast, comments, commentEnds };
}

// Modules are tried first; plain scripts (e.g. CommonJS) are the fallback.
function parseAny(source) {
  try {
    return parseJs(source, "module");
  } catch (moduleError) {
    try {
      return parseJs(source, "script");
    } catch {
      throw moduleError;
    }
  }
}

function keyName(key, computed, source) {
  if (computed) return `[${source.slice(key.start, key.end)}]`;
  if (key.type === "Identifier") return key.name;
  if (key.type === "PrivateIdentifier") return `#${key.name}`;
  return String(key.value);
}

function paramsOf(fn, source) {
  return fn.params.map((p) => source.slice(p.start, p.end));
}

function functionInfo(fn, source) {
  return {
    params: paramsOf(fn, source),
    async: fn.async,
    generator: fn.generator,
  };
}

// `binding` is true for variables/assignments, false for class and object members.
function describeValue(name, value, source, binding) {
  if (value && FUNCTION_TYPES.has(value.type)) {
    return {
      kind: binding ? "function" : "method",
      name,
      ...functionInfo(value, source),
    };
  }
  if (value && value.type === "ClassExpression") {
    return {
      kind: "class",
      name,
      extends: value.superClass
        ? source.slice(value.superClass.start, value.superClass.end)
        : null,
    };
  }
  return { kind: binding ? "variable" : "property", name };
}

function describe(node, source) {
  switch (node.type) {
    case "FunctionDeclaration":
      return {
        kind: "function",
        name: node.id?.name ?? null,
        ...functionInfo(node, source),
      };

    case "ClassDeclaration":
      return {
        kind: "class",
        name: node.id?.name ?? null,
        extends: node.superClass
          ? source.slice(node.superClass.start, node.superClass.end)
          : null,
      };

    case "VariableDeclaration": {
      const [first] = node.declarations;
      if (first.id.type !== "Identifier") return null;
      return {
        ...describeValue(first.id.name, first.init, source, true),
        declarationKind: node.kind,
      };
    }

    case "ExportNamedDeclaration":
    case "ExportDefaultDeclaration": {
      const inner = node.declaration && describe(node.declaration, source);
      if (!inner) return null;
      return {
        ...inner,
        exported: true,
        default: node.type === "ExportDefaultDeclaration",
      };
    }

    case "MethodDefinition": {
      const name = keyName(node.key, node.computed, source);
      const kind = node.kind === "method" ? "method" : node.kind; // constructor | get | set
      return {
        kind,
        name,
        static: node.static,
        ...functionInfo(node.value, source),
      };
    }

    case "PropertyDefinition": {
      const name = keyName(node.key, node.computed, source);
      const info = describeValue(name, node.value, source, false);
      return { ...info, static: node.static };
    }

    case "Property": {
      const name = keyName(node.key, node.computed, source);
      if (node.kind === "get" || node.kind === "set") {
        return { kind: node.kind, name, ...functionInfo(node.value, source) };
      }
      return describeValue(name, node.value, source, false);
    }

    case "ExpressionStatement": {
      const expr = node.expression;
      if (
        expr.type !== "AssignmentExpression" ||
        expr.left.type !== "MemberExpression"
      )
        return null;
      const name = source.slice(expr.left.start, expr.left.end);
      return describeValue(name, expr.right, source, true);
    }

    default:
      return null;
  }
}

/**
 * Find every JSDoc-style block comment in `source` and the declaration it precedes.
 * Returns [{ comment, declaration }]; `declaration` is null when nothing recognisable follows.
 * Throws if the source is not valid JavaScript.
 */
export function findDocumentedDeclarations(source) {
  const { ast, comments, commentEnds } = parseAny(source);

  // Outermost node wins when several start at the same offset (post-order walk, so later = outer).
  const nodeAt = new Map();
  full(ast, (node) => {
    const current = nodeAt.get(node.start);
    if (!current || node.end >= current.end) nodeAt.set(node.start, node);
  });

  return comments.map(({ text, end }) => {
    // Step over whitespace and any comments (e.g. eslint directives) between the doc comment and the code.
    let pos = end;
    for (;;) {
      const next = source.slice(pos).search(/\S/);
      if (next === -1) {
        pos = -1;
        break;
      }
      pos += next;
      if (!commentEnds.has(pos)) break;
      pos = commentEnds.get(pos);
    }
    const node = pos === -1 ? undefined : nodeAt.get(pos);
    return { comment: text, declaration: node ? describe(node, source) : null };
  });
}
