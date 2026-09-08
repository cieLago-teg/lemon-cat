import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url))
});

const eslintConfig = [
  { ignores: ['.worker/**', '.next/**', '**/node_modules/**', 'app-shell/dist/**'] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { files: ['**/*.cjs'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  { files: ['app-shell/*.js'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  { files: ['scripts/worker.ts'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  {
    ignores: ["lib/pet/**/*.js", "lib/pet/**/*.cjs", "spike/**", "deploy/**"]
  },
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@next/next/no-img-element": "warn"
    }
  }
];

export default eslintConfig;
