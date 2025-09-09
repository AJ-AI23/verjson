export interface LogContext {
  userId?: string;
  functionName: string;
  operation: string;
  requestId?: string;
  executionTime?: number;
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export class EdgeFunctionLogger {
  private context: LogContext;
  private startTime: number;

  constructor(functionName: string, operation: string, userId?: string) {
    this.context = {
      functionName,
      operation,
      userId,
      requestId: crypto.randomUUID().substring(0, 8)
    };
    this.startTime = Date.now();
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const executionTime = Date.now() - this.startTime;
    
    const logEntry = {
      timestamp,
      level,
      function: this.context.functionName,
      operation: this.context.operation,
      userId: this.context.userId || 'anonymous',
      requestId: this.context.requestId,
      executionTime: `${executionTime}ms`,
      message,
      ...(data && { data })
    };

    return JSON.stringify(logEntry, null, 2);
  }

  debug(message: string, data?: any) {
    console.log(this.formatMessage(LogLevel.DEBUG, message, data));
  }

  info(message: string, data?: any) {
    console.log(this.formatMessage(LogLevel.INFO, message, data));
  }

  warn(message: string, data?: any) {
    console.warn(this.formatMessage(LogLevel.WARN, message, data));
  }

  error(message: string, error?: any) {
    const errorData = error instanceof Error 
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;
    console.error(this.formatMessage(LogLevel.ERROR, message, errorData));
  }

  logRequest(method: string, url: string, headers?: any) {
    this.debug('Incoming request', {
      method,
      url,
      headers: headers ? Object.fromEntries(Object.entries(headers).filter(([key]) => 
        !key.toLowerCase().includes('authorization')
      )) : undefined
    });
  }

  logAuth(user: any) {
    if (user) {
      this.info('User authenticated', { userId: user.id, email: user.email });
      this.context.userId = user.id;
    } else {
      this.warn('Authentication failed or user not found');
    }
  }

  logDatabaseQuery(table: string, operation: string, params?: any) {
    this.debug(`Database ${operation} on ${table}`, params);
  }

  logDatabaseResult(table: string, operation: string, resultCount?: number, error?: any) {
    if (error) {
      this.error(`Database ${operation} on ${table} failed`, error);
    } else {
      this.info(`Database ${operation} on ${table} completed`, { 
        resultCount: resultCount ?? 'unknown' 
      });
    }
  }

  logResponse(status: number, data?: any) {
    const executionTime = Date.now() - this.startTime;
    this.info('Sending response', {
      status,
      executionTime: `${executionTime}ms`,
      hasData: !!data,
      dataSize: data ? JSON.stringify(data).length : 0
    });
  }

  logError(message: string, error: any, context?: any) {
    const errorData = {
      ...(error instanceof Error 
        ? { name: error.name, message: error.message, stack: error.stack }
        : { error }),
      ...(context && { context })
    };
    this.error(message, errorData);
  }
}