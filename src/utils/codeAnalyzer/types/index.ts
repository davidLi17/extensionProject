// 添加新的接口定义
export interface ContextInfo {
  functionName: string | null;
  objectName: string | null;
  path: string[]; // 完整调用路径
  variableScope: ScopeInfo | null;
}

// 作用域信息接口
export interface ScopeInfo {
  variables: VariableInfo[];
  parent: ScopeInfo | null;
  type: "function" | "block" | "global" | "method";
  start: number;
  end: number;
  node: any;
  variableMap?: Map<string, VariableInfo>; // 优化：添加变量映射以提高查找速度
}

// 变量信息接口
export interface VariableInfo {
  name: string;
  declarationStart: number;
  declarationEnd: number;
  references: number[];
  isParameter: boolean;
}

// 插入位置的数据结构接口
export interface InsertionPosition {
  line: number;
  character: number;
  isEndOfStatement: boolean;
  scopeStart?: number; // 变量所在作用域开始位置
  scopeEnd?: number; // 变量所在作用域结束位置
}

// 日志级别控制
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}
