
import '@testing-library/jest-dom';

// Add TypeScript declarations for Jest globals to fix type errors in test files
declare global {
  // eslint-disable-next-line no-var
  var jest: {
    fn: (implementation?: any) => any;
    mock: (moduleName: string, factory?: any) => void;
    clearAllMocks: () => void;
    useFakeTimers: () => void;
    useRealTimers: () => void;
    runAllTimers: () => void;
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
    
    // Add Mock type to fix TS2694 errors
    type Mock<T = any> = {
      (...args: any[]): any;
      mockImplementation: (fn: (...args: any[]) => any) => Mock<T>;
      mockReturnValue: (value: any) => Mock<T>;
      mockReset: () => Mock<T>;
      mockRestore: () => void;
      mockClear: () => Mock<T>;
      mock: {
        calls: any[][];
        instances: any[];
        contexts: any[];
        results: any[];
      };
    };
  }
  
  const expect: jest.Expect;
  const it: jest.It;
  const describe: jest.Describe;
  const beforeEach: jest.Lifecycle;
  const afterEach: jest.Lifecycle;
}
