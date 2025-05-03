import { LogLevel } from "../types";

export class Logger {
  private static level: LogLevel = LogLevel.ERROR;

  static setLevel(level: LogLevel) {
    this.level = level;
  }

  static error(message: string, ...args: any[]) {
    if (this.level >= LogLevel.ERROR) {
      console.error(`[错误] ${message}`, ...args);
    }
  }

  static warn(message: string, ...args: any[]) {
    if (this.level >= LogLevel.WARN) {
      console.warn(`[警告] ${message}`, ...args);
    }
  }

  static info(message: string, ...args: any[]) {
    if (this.level >= LogLevel.INFO) {
      console.log(`[信息] ${message}`, ...args);
    }
  }

  static debug(message: string, ...args: any[]) {
    if (this.level >= LogLevel.DEBUG) {
      console.log(`[调试] ${message}`, ...args);
    }
  }

  static trace(message: string, ...args: any[]) {
    if (this.level >= LogLevel.TRACE) {
      console.log(`[跟踪] ${message}`, ...args);
    }
  }
}
