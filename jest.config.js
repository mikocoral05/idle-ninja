module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  // Enable coverage collection
  collectCoverage: true,
  // The directory where Jest should output its coverage files
  coverageDirectory: "coverage",
  // An array of glob patterns indicating a set of files for which coverage information should be collected.
  // We want to measure the source file, but not the test file itself.
  collectCoverageFrom: ["src/idle-ninja.ts"],
};
