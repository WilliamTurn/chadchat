import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

export const DUMMY_PASSWORD = generateDummyPassword();

export const suggestions = [
  "I want to build muscle. Build me a workout plan.",
  "Make me a meal plan so I can lose weight fast.",
  "Rate my photo.",
  "I keep failing — fix my routine.",
];
