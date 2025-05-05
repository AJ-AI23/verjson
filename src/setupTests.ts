
import '@testing-library/jest-dom';

// Add TypeScript declarations for Jest globals to fix type errors in test files
declare global {
  // Extend the NodeJS namespace for TypeScript
  const expect: jest.Expect;
  const it: jest.It;
  const describe: jest.Describe;
  const jest: typeof import('jest');
  const beforeEach: jest.Lifecycle;
  const afterEach: jest.Lifecycle;
}
