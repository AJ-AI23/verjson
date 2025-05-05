
import '@testing-library/jest-dom';

// Add TypeScript declarations for Jest globals to fix type errors in test files
declare global {
  // Extend the NodeJS namespace to include Jest globals
  namespace NodeJS {
    interface Global {
      expect: typeof import('expect');
      it: typeof import('@jest/globals').it;
      describe: typeof import('@jest/globals').describe;
      jest: typeof import('jest');
    }
  }

  // Add Jest globals to the global namespace
  const expect: typeof import('expect');
  const it: typeof import('@jest/globals').it;
  const describe: typeof import('@jest/globals').describe;
  const jest: typeof import('jest');
}
