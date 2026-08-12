import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";
import oxlint from "eslint-plugin-oxlint";
import playwright from "eslint-plugin-playwright";
import reactHooks from "eslint-plugin-react-hooks";
import reactYouMightNotNeedAnEffect from "eslint-plugin-react-you-might-not-need-an-effect";
import vitest from "eslint-plugin-vitest";
import tseslint from "typescript-eslint";

const eslintIgnorePatterns = [
  "public/engine/**",
  "public/models/**",
  "public/ort/**",
  "tests/stockfish/.generated/**",
  "tests/maia/.generated/**",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Chess tree / engine code uses intentional non-null after guards.
      "@typescript-eslint/no-non-null-assertion": "off",
      // Numbers and booleans in template strings are idiomatic here.
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowNumber: true,
          allowBoolean: true,
          allowNullish: false,
        },
      ],
      // `onClick={() => doThing()}` is fine.
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true },
      ],
      // chess.js Square unions often widen with `string`.
      "@typescript-eslint/no-redundant-type-constituents": "off",
      // Interface dispose() methods stay async for API symmetry.
      "@typescript-eslint/require-await": "off",
      // Tree prune uses dynamic node-id keys.
      "@typescript-eslint/no-dynamic-delete": "off",
      // Workers/sessions poll flags mutated by async event handlers.
      "@typescript-eslint/no-unnecessary-condition": [
        "error",
        { allowConstantLoopConditions: true },
      ],
    },
  },
  reactHooks.configs.flat["recommended-latest"],
  reactYouMightNotNeedAnEffect.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      boundaries,
    },
    settings: {
      "boundaries/include": ["src/**/*"],
      "boundaries/elements": [
        { type: "domain", pattern: "src/domain/**" },
        { type: "engines", pattern: "src/engines/**" },
        { type: "storage", pattern: "src/storage/**" },
        { type: "workers", pattern: "src/workers/**" },
        { type: "features", pattern: "src/features/**" },
        { type: "components", pattern: "src/components/**" },
        { type: "lib", pattern: "src/lib/**" },
        { type: "app", pattern: "src/app/**" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            {
              allow: {
                to: { module: { origin: "external" } },
              },
            },
            {
              allow: {
                to: { module: { origin: "core" } },
              },
            },
            {
              from: { element: { type: "domain" } },
              allow: {
                to: {
                  element: { types: { anyOf: ["domain", "lib"] } },
                },
              },
            },
            {
              from: { element: { type: "engines" } },
              allow: {
                to: {
                  element: { types: { anyOf: ["domain", "engines", "lib"] } },
                },
              },
            },
            {
              from: { element: { type: "storage" } },
              allow: {
                to: {
                  element: { types: { anyOf: ["domain", "storage", "lib"] } },
                },
              },
            },
            {
              from: { element: { type: "workers" } },
              allow: {
                to: {
                  element: {
                    types: { anyOf: ["domain", "engines", "workers"] },
                  },
                },
              },
            },
            {
              from: { element: { type: "features" } },
              allow: {
                to: {
                  element: {
                    types: {
                      anyOf: [
                        "domain",
                        "engines",
                        "storage",
                        "features",
                        "components",
                        "lib",
                      ],
                    },
                  },
                },
              },
            },
            {
              from: { element: { type: "components" } },
              allow: {
                to: {
                  element: {
                    types: { anyOf: ["domain", "components", "lib"] },
                  },
                },
              },
            },
            {
              from: { element: { type: "lib" } },
              allow: {
                to: {
                  element: { type: "lib" },
                },
              },
            },
            {
              from: { element: { type: "app" } },
              allow: {
                to: {
                  element: {
                    types: { anyOf: ["components", "lib"] },
                  },
                },
              },
            },
          ],
        },
      ],
      "boundaries/no-unknown": "off",
      "boundaries/no-unknown-files": "off",
    },
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "boundaries/dependencies": "off",
    },
  },
  {
    // Sole components → features bridge for the RSC/client shell.
    files: ["src/components/game/game-shell-client.tsx"],
    rules: {
      "boundaries/dependencies": "off",
    },
  },
  {
    // Flags mutated by async worker/event handlers; TS control-flow is wrong.
    files: [
      "src/workers/**/*.{ts,tsx}",
      "src/engines/stockfish/worker-runtime.ts",
      "src/engines/maia/worker-runtime.ts",
      "src/features/game/coaching-controller.ts",
      "src/features/game/maia-session.ts",
    ],
    rules: {
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },
  {
    files: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "tests/static-host/**/*.{test,spec}.{ts,tsx}",
      "vitest.config.mts",
    ],
    ...vitest.configs.recommended,
  },
  {
    ...playwright.configs["flat/recommended"],
    files: [
      "tests/accessibility/**/*.{ts,tsx}",
      "tests/coaching/**/*.{ts,tsx}",
      "tests/composed/**/*.{ts,tsx}",
      "tests/game/**/*.{ts,tsx}",
      "tests/maia/**/*.{ts,tsx}",
      "tests/persistence/**/*.{ts,tsx}",
      "tests/stockfish/**/*.{ts,tsx}",
      "tests/time-travel/**/*.{ts,tsx}",
      "tests/shared/**/*.{ts,tsx}",
    ],
  },
  {
    // Playwright locator typings treat attributes as string; ?? is defensive.
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}", "scripts/**/*.{js,mjs,cjs}"],
    ...tseslint.configs.disableTypeChecked,
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ...eslintIgnorePatterns,
  ]),
  // Disable ESLint rules already covered by Oxlint (keep last).
  ...oxlint.buildFromOxlintConfigFile("./.oxlintrc.json"),
]);

export default eslintConfig;
