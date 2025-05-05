
import '@testing-library/jest-dom';

// Add TypeScript declarations for Jest globals to fix type errors in test files
declare global {
  // Extend the NodeJS namespace for TypeScript
  const expect: any;
  const it: any;
  const describe: any;
  const jest: any;
  const beforeEach: any;
  const afterEach: any;
}
