import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import { globalIgnores } from "eslint/config";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  globalIgnores([".next/**", "node_modules/**", "deploy/**", "next-env.d.ts", "eslint.config.mjs"]),
  {
    files: ["src/mini-app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["@/src/server/**"], message: "Mini App must call HTTP APIs instead of importing server code." }] }],
    },
  },
  {
    files: ["src/mini-app/**/*.{ts,tsx}"],
    rules: { "@next/next/no-img-element": "off" },
  },
];
