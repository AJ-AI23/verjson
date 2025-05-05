
import '@testing-library/jest-dom';

// Add TypeScript declarations for Jest globals to fix type errors in test files
declare global {
  // eslint-disable-next-line no-var
  var jest: {
    fn: (implementation?: any) => any;
    mock: (moduleName: string, factory?: any) => void;
    clearAllMocks: () => void;
  };
  
  // Extend the NodeJS namespace for TypeScript
  namespace jest {
    interface Expect {
      (value: any): any;
    }
    interface It {
      (name: string, fn: () => any): any;
    }
    interface Describe {
      (name: string, fn: () => any): any;
    }
    interface Lifecycle {
      (fn: () => any): any;
    }
  }
  
  const expect: jest.Expect;
  const it: jest.It;
  const describe: jest.Describe;
  const beforeEach: jest.Lifecycle;
  const afterEach: jest.Lifecycle;
}
