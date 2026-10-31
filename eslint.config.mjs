import globals from "globals";
import js from "@eslint/js";
import nodeCoreTestPlugin from "eslint-plugin-node-core-test";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";

const config = [
  {
    ignores: ["dist/"],
  },
  js.configs.recommended,
  prettierConfig,
  {
    ...nodeCoreTestPlugin.configs.recommended,
    files: ["test/**"],
    rules: {
      ...nodeCoreTestPlugin.configs.recommended.rules,
      "node-core-test/no-exclusive-tests": ["error"],
      "node-core-test/no-incomplete-tests": ["error"],
      "node-core-test/no-skipped-tests": ["error"],
    },
  },
  {
    plugins: {
      prettier: prettierPlugin,
    },
    languageOptions: {
      ecmaVersion: 2026,
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      "prettier/prettier": ["error"],
    },
  },
  {
    files: ["build.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];

export default config;
