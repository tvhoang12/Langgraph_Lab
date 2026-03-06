import { LoggerService, Injectable } from '@nestjs/common';

@Injectable()
export class CustomLogger implements LoggerService {
  private context: string;

  setContext(context: string) {
    this.context = context;
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = this.getTimestamp();
    const contextStr = this.context ? ` [${this.context}]` : '';
    return `[${timestamp}]${contextStr} ${level} ${message}`;
  }

  log(message: string, context?: string) {
    const ctx = context || this.context;
    console.log(this.formatMessage('LOG', message).replace('[undefined]', ctx ? ` [${ctx}]` : ''));
  }

  error(message: string, trace?: string, context?: string) {
    const ctx = context || this.context;
    const msg = this.formatMessage('ERROR', message).replace('[undefined]', ctx ? ` [${ctx}]` : '');
    console.error(msg);
    if (trace) console.error(trace);
  }

  warn(message: string, context?: string) {
    const ctx = context || this.context;
    console.warn(this.formatMessage('WARN', message).replace('[undefined]', ctx ? ` [${ctx}]` : ''));
  }

  debug(message: string, context?: string) {
    const ctx = context || this.context;
    if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('DEBUG', message).replace('[undefined]', ctx ? ` [${ctx}]` : ''));
    }
  }

  verbose(message: string, context?: string) {
    const ctx = context || this.context;
    if (process.env.VERBOSE || process.env.NODE_ENV === 'development') {
      console.log(this.formatMessage('VERBOSE', message).replace('[undefined]', ctx ? ` [${ctx}]` : ''));
    }
  }
}
