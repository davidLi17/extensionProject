/*
 * @Author: lihaoge lihaoge@bytedance.com
 * @Date: 2025-11-27
 * @Description: 日志工具类，用于在代码分析过程中输出日志
 */
import { LogLevel } from "../types";

export class Logger {
  // 默认设置为 WARN 级别，只输出 ERROR 和 WARN
  private static level: LogLevel = LogLevel.WARN;

  static setLevel(level: LogLevel) {
    this.level = level;
  }

  // 日志级别判断逻辑：当前设置的级别 >= 要输出的级别时才输出
  // LogLevel: ERROR(0) < WARN(1) < INFO(2) < DEBUG(3) < TRACE(4)
  // 例如：设置为 WARN(1)，只会输出 ERROR(0) 和 WARN(1)

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
