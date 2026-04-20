module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  // Enable coverage collection
  collectCoverage: true,
  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',
  // An array of glob patterns indicating a set of files for which coverage information should be collected.
  // We want to measure the source file, but not the test file itself.
  collectCoverageFrom: ['idle-ninja.ts'],
  // Only run unit tests (files ending in .test.ts), ignore Playwright E2E tests (.spec.ts)
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
  // Enforce 100% coverage
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
