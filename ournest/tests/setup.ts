import "@testing-library/jest-dom/vitest";
// Business logic must not depend on the machine's time zone.
process.env.TZ = "America/New_York";
