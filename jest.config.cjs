/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  verbose: true,
  reporters: [
    'default',
    [
      'jest-html-reporter',
      {
        outputPath: 'test-report.html',
        pageTitle: 'CI Workflow Runner — Test Report',
        includeFailureMsg: true,
        includeConsoleLog: false,
      },
    ],
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.types.ts',   // type-only files have no runtime code
    '!src/config/index.ts', // thin env-read wrapper, no logic to test
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches:   75,
      functions:  88,
      lines:      88,
      statements: 88,
    },
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          isolatedModules: true,
        },
      },
    ],
  },
  testMatch: ['**/tests/**/*.test.ts'],
};
