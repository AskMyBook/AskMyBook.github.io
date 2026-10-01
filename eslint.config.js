// فحص الكود (lint): أخطاء حقيقية بس. ملفات الموقع scripts عادية بتتشارك متغيرات عامة، فـ no-undef مقفول ليها.
import js from "@eslint/js";
import globals from "globals";
export default [
  { ignores: ["lib/**", "node_modules/**", "server/worker-bundle.js", "models/**", "tests/output/**", "data/**"] },
  { ...js.configs.recommended, files: ["**/*.js", "**/*.mjs"] },
  { files: ["*.js"], languageOptions: { ecmaVersion: 2023, sourceType: "script", globals: { ...globals.browser, pdfjsLib: "readonly", Tesseract: "readonly", PDFLib: "readonly", supabase: "readonly", puter: "readonly" } },
    rules: { "no-undef": "off", "no-unused-vars": "off", "no-empty": "off", "no-useless-escape": "off", "no-cond-assign": "off", "no-control-regex": "off", "no-misleading-character-class": "off", "no-async-promise-executor": "off", "no-inner-declarations": "off", "no-prototype-builtins": "off", "no-sparse-arrays": "off", "no-fallthrough": "off", "no-redeclare": ["error", { builtinGlobals: false }], "no-unsafe-finally": "off" } },
  { files: ["tests/**/*.mjs"], languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.node, ...globals.browser } },
    rules: { "no-undef": "off", "no-unused-vars": "off", "no-empty": "off", "no-useless-escape": "off", "no-cond-assign": "off", "no-control-regex": "off", "no-misleading-character-class": "off", "no-async-promise-executor": "off" } },   // كود page.evaluate بيستخدم متغيرات الصفحة
  { files: ["eslint.config.js", "server/**/*.js", "server/**/*.mjs"], languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.node, ...globals.browser } },
    rules: { "no-unused-vars": "off", "no-empty": "off", "no-useless-escape": "off", "no-cond-assign": "off", "no-control-regex": "off", "no-misleading-character-class": "off", "no-async-promise-executor": "off", "no-undef": "error" } }
];
