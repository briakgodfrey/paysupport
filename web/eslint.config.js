import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * Storage APIs are banned app-wide. The session token lives in memory only:
 * anything in localStorage or sessionStorage can be read by any script that
 * runs on the page, so a single XSS bug would leak the token.
 */
const storageRestrictions = [
  {
    name: "localStorage",
    message: "Do not persist data in web storage. The session token lives in memory only (see auth/).",
  },
  {
    name: "sessionStorage",
    message: "Do not persist data in web storage. The session token lives in memory only (see auth/).",
  },
];

/**
 * Components never call fetch directly. Every request goes through the API
 * client so timeouts, auth headers, and runtime validation can't be skipped.
 */
const fetchRestriction = {
  name: "fetch",
  message: "Use the API client in src/api/ instead of calling fetch directly.",
};

export default defineConfig(
  globalIgnores(["dist", "coverage"]),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // This config file is plain JS and isn't part of a TypeScript project.
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },

  jsxA11y.flatConfigs.strict,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },

  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Console output can end up in shared screenshots, screen recordings,
      // and browser extensions. Banning it means a token or customer email
      // can't be logged by accident.
      "no-console": "error",
      "no-restricted-globals": ["error", fetchRestriction, ...storageRestrictions],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "localStorage", message: storageRestrictions[0].message },
        { object: "window", property: "sessionStorage", message: storageRestrictions[1].message },
        { object: "window", property: "fetch", message: fetchRestriction.message },
        { object: "globalThis", property: "fetch", message: fetchRestriction.message },
      ],
      "no-restricted-syntax": [
        "error",
        {
          // API text is untrusted. Rendering it as HTML would let a crafted
          // value in the ledger or vendor response run script in the
          // dashboard (stored XSS). React escapes text children by default.
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Never render HTML from strings. Render API text as plain text children.",
        },
        {
          // Inline styles bypass the design tokens and would need
          // 'unsafe-inline' in the Content Security Policy.
          selector: "JSXAttribute[name.name='style']",
          message: "Use a class from a .css file built on the design tokens instead of inline styles.",
        },
      ],
    },
  },
  {
    // The API client is the one place allowed to call fetch.
    files: ["src/api/client.ts"],
    rules: {
      "no-restricted-globals": ["error", ...storageRestrictions],
    },
  },
);
