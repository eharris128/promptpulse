// eslint.config.js
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: ["docs/**/*", "client/.next/**/*", "client/out/**/*"]
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      },
    },
    rules: {
      // Critical rules for string literal errors
      "no-template-curly-in-string": "error", // Catches ${} in regular strings
      "no-useless-escape": "error",           // Prevents unnecessary escapes
      "quotes": ["error", "double", {
        "avoidEscape": true,
        "allowTemplateLiterals": true
      }],
      "prefer-template": "warn",              // Encourages safer template literals

      // Additional syntax protection
      "semi": ["error", "always"],
      "no-trailing-spaces": "error",
      "eol-last": "error"
    },
  },
]);
