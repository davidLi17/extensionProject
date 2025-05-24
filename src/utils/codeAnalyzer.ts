import * as vscode from "vscode";
import * as parser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import * as babelTypes from "@babel/types";

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
interface InsertionPosition {
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

// 日志类，控制日志输出级别
class Logger {
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

// 添加缓存机制
class AstCache {
  private static astMap = new Map<string, any>();
  private static scopeMap = new Map<string, ScopeInfo>();
  private static contentChecksums = new Map<string, number>();

  // 简单的内容哈希函数，用于检测文件内容变化
  private static checksum(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash; // 转换为32位整数
    }
    return hash;
  }

  static getAst(code: string, fileName: string): any {
    // 使用文件名和内容哈希作为缓存键
    const checksum = this.checksum(code);
    const key = `${fileName}:${checksum}`;

    // 如果哈希匹配，直接返回缓存的AST
    if (
      this.contentChecksums.get(fileName) === checksum &&
      this.astMap.has(key)
    ) {
      Logger.debug(`使用缓存的AST: ${fileName}`);
      return this.astMap.get(key);
    }

    // 更新内容哈希
    this.contentChecksums.set(fileName, checksum);

    // 解析并缓存
    Logger.info(`解析文件AST: ${fileName}`);
    const ast = parseCode(code, fileName);
    this.astMap.set(key, ast);
    return ast;
  }

  static getScopeTree(code: string, fileName: string): ScopeInfo {
    // 使用文件名和内容哈希作为缓存键
    const checksum = this.checksum(code);
    const key = `${fileName}:${checksum}`;

    // 如果哈希匹配，直接返回缓存的作用域树
    if (
      this.contentChecksums.get(fileName) === checksum &&
      this.scopeMap.has(key)
    ) {
      Logger.debug(`使用缓存的作用域树: ${fileName}`);
      return this.scopeMap.get(key)!;
    }

    // 更新内容哈希
    this.contentChecksums.set(fileName, checksum);

    // 重建作用域树并缓存
    Logger.info(`构建文件作用域树: ${fileName}`);
    const ast = this.getAst(code, fileName);
    const scope = buildScopeTree(ast);
    this.scopeMap.set(key, scope);
    return scope;
  }

  static clearCache(fileName?: string) {
    if (fileName) {
      // 清除指定文件的缓存
      Logger.info(`清除文件缓存: ${fileName}`);
      for (const key of this.astMap.keys()) {
        if (key.startsWith(`${fileName}:`)) {
          this.astMap.delete(key);
          this.scopeMap.delete(key);
          this.contentChecksums.delete(fileName);
        }
      }
    } else {
      // 清除所有缓存
      Logger.info("清除所有缓存");
      this.astMap.clear();
      this.scopeMap.clear();
      this.contentChecksums.clear();
    }
  }
}

// 优化解析代码生成AST的通用函数
function parseCode(code: string, fileName: string) {
  try {
    const sourceType =
      fileName.endsWith(".tsx") || fileName.endsWith(".jsx")
        ? "script"
        : "module";

    return parser.parse(code, {
      sourceType: sourceType as "module" | "script" | "unambiguous",
      plugins: ["typescript", "jsx", "decorators-legacy", "classProperties"],
    });
  } catch (error) {
    Logger.error(`解析代码失败: ${fileName}`, error);
    //@ts-ignore
    throw new Error(`解析失败: ${error.message}`);
  }
}

// 优化构建作用域树的函数，使用Map存储变量，提高查找效率
function buildScopeTree(ast: any) {
  Logger.debug("开始构建作用域树");

  // 初始化全局作用域
  const globalScope: ScopeInfo = {
    variables: [],
    parent: null,
    type: "global",
    start: 0,
    end: Infinity,
    node: null,
    variableMap: new Map<string, VariableInfo>(), // 优化: 使用Map存储变量
  };

  let currentScope = globalScope;
  const scopeStack: ScopeInfo[] = [globalScope];

  // 记录已处理过的节点，避免重复处理
  const processedNodes = new Set<any>();

  traverse(ast, {
    enter(path) {
      const node = path.node;

      // 跳过没有位置信息的节点
      if (
        !node.loc ||
        typeof node.start !== "number" ||
        typeof node.end !== "number" ||
        processedNodes.has(node)
      ) {
        return;
      }

      processedNodes.add(node);

      // 创建新作用域的情况
      if (createNewScope(path)) {
        const scopeType = getScopeType(path);
        const newScope: ScopeInfo = {
          variables: [],
          parent: currentScope,
          type: scopeType,
          start: node.start,
          end: node.end,
          node: node,
          variableMap: new Map<string, VariableInfo>(), // 优化: 使用Map存储变量
        };

        scopeStack.push(newScope);
        currentScope = newScope;

        // 收集函数参数作为变量
        collectFunctionParams(path, currentScope);
      }

      // 特殊处理对象方法
      if (babelTypes.isObjectMethod(node)) {
        Logger.trace(
          `处理对象方法: ${
            babelTypes.isIdentifier(node.key)
              ? node.key.name
              : babelTypes.isStringLiteral(node.key) ||
                babelTypes.isNumericLiteral(node.key)
              ? String(node.key.value)
              : "匿名"
          }`
        );
        // 确保对象方法获得正确的作用域
        const methodScope: ScopeInfo = {
          variables: [],
          parent: currentScope,
          type: "method",
          start: node.start || 0,
          end: node.end || Infinity,
          node: node,
          variableMap: new Map<string, VariableInfo>(), // 优化: 使用Map存储变量
        };

        scopeStack.push(methodScope);
        currentScope = methodScope;

        // 收集对象方法参数
        if (node.params) {
          for (const param of node.params) {
            if (babelTypes.isIdentifier(param)) {
              const variable: VariableInfo = {
                name: param.name,
                declarationStart: param.start || node.start || 0,
                declarationEnd: param.end || node.start || 0,
                references: [],
                isParameter: true,
              };
              currentScope.variables.push(variable);
              currentScope.variableMap?.set(param.name, variable);
            }
          }
        }
      }

      // 收集变量声明
      if (babelTypes.isVariableDeclaration(node)) {
        for (const declarator of node.declarations) {
          if (babelTypes.isIdentifier(declarator.id)) {
            const variable: VariableInfo = {
              name: declarator.id.name,
              declarationStart: declarator.start || node.start,
              declarationEnd: declarator.end || node.end,
              references: [],
              isParameter: false,
            };
            currentScope.variables.push(variable);
            currentScope.variableMap?.set(declarator.id.name, variable);
          }
        }
      }

      // 收集变量引用
      if (babelTypes.isIdentifier(node) && !isDeclaration(path)) {
        const varName = node.name;
        // 查找最近的包含此变量定义的作用域
        let scope: ScopeInfo | null = currentScope;
        while (scope) {
          // 优化：使用Map直接查找变量
          const variable = scope.variableMap?.get(varName);
          if (variable) {
            variable.references.push(node.start);
            break;
          }
          scope = scope.parent;
        }
      }
    },

    exit(path) {
      const node = path.node;

      if (
        !node.loc ||
        typeof node.start !== "number" ||
        typeof node.end !== "number"
      ) {
        return;
      }

      // 离开作用域
      if (createNewScope(path) || babelTypes.isObjectMethod(node)) {
        scopeStack.pop();
        currentScope = scopeStack[scopeStack.length - 1];
      }
    },
  });

  Logger.debug(`作用域树构建完成，全局变量数: ${globalScope.variables.length}`);
  return globalScope;
}

// 判断是否需要创建新作用域
function createNewScope(path: NodePath) {
  const node = path.node;
  return (
    babelTypes.isFunction(node) ||
    babelTypes.isBlockStatement(node) ||
    babelTypes.isObjectMethod(node) ||
    babelTypes.isClassMethod(node)
  );
}

// 获取作用域类型
function getScopeType(
  path: NodePath
): "function" | "block" | "global" | "method" {
  const node = path.node;

  if (
    babelTypes.isFunction(node) ||
    babelTypes.isArrowFunctionExpression(node)
  ) {
    return "function";
  }
  if (babelTypes.isObjectMethod(node) || babelTypes.isClassMethod(node)) {
    return "method";
  }
  if (babelTypes.isBlockStatement(node)) {
    return "block";
  }
  return "global";
}

// 收集函数参数
function collectFunctionParams(path: NodePath, scope: ScopeInfo) {
  const node = path.node;

  if (
    (babelTypes.isFunction(node) ||
      babelTypes.isObjectMethod(node) ||
      babelTypes.isClassMethod(node)) &&
    node.params
  ) {
    for (const param of node.params) {
      if (babelTypes.isIdentifier(param)) {
        const variable: VariableInfo = {
          name: param.name,
          declarationStart: param.start ?? node.start ?? 0,
          declarationEnd: param.end ?? node.start ?? 0,
          references: [],
          isParameter: true,
        };
        scope.variables.push(variable);
        scope.variableMap?.set(param.name, variable);
      }
    }
  }
}

// 判断是否是变量声明
function isDeclaration(path: NodePath): boolean {
  const parent = path.parent;

  return (
    (babelTypes.isVariableDeclarator(parent) && path.node === parent.id) ||
    //@ts-ignore
    (babelTypes.isFunction(parent) && parent.id && path.node === parent.id) ||
    (babelTypes.isFunction(parent) &&
      Array.isArray(parent.params) &&
      //@ts-ignore
      parent.params.includes(path.node))
  );
}

/**
 * 构建节点路径层次，优化版本
 * 主要用于获取函数调用的完整路径，特别是处理嵌套对象和类方法
 * @param path 节点路径
 * @returns 路径字符串数组，例如 ["outer", "inner", "deepMethod"]
 */
function buildPathHierarchy(path: NodePath): string[] {
  const result: string[] = [];
  Logger.trace(`开始构建路径层次，节点类型: ${path.node.type}`);

  // 处理对象方法特殊情况
  if (
    babelTypes.isObjectMethod(path.node) &&
    babelTypes.isIdentifier(path.node.key)
  ) {
    return buildObjectMethodPath(path);
  }

  // 处理类方法特殊情况
  if (
    babelTypes.isClassMethod(path.node) &&
    babelTypes.isIdentifier(path.node.key)
  ) {
    return buildClassMethodPath(path);
  }

  // 通用情况处理
  let current: NodePath | null = path;
  const visitedPaths = new Set<NodePath>(); // 避免循环引用

  while (current && !visitedPaths.has(current)) {
    visitedPaths.add(current);

    // 处理函数声明/表达式
    if (
      (babelTypes.isFunctionDeclaration(current.node) ||
        babelTypes.isFunctionExpression(current.node)) &&
      current.node.id &&
      babelTypes.isIdentifier(current.node.id)
    ) {
      result.unshift(current.node.id.name);
      Logger.trace(`添加函数名: ${current.node.id.name}`);
      break;
    }

    // 处理箭头函数
    else if (
      babelTypes.isArrowFunctionExpression(current.node) &&
      current.parent &&
      babelTypes.isVariableDeclarator(current.parent)
    ) {
      if (babelTypes.isIdentifier(current.parent.id)) {
        result.unshift(current.parent.id.name);
        Logger.trace(`添加箭头函数变量名: ${current.parent.id.name}`);
      }
      break;
    }

    current = current.parentPath;
  }

  if (result.length > 0) {
    Logger.debug(`构建路径结果: ${result.join(".")}`);
  } else {
    Logger.debug("路径构建结果为空");
  }
  return result;
}

/**
 * 专门用于构建对象方法的路径
 * 处理多级嵌套对象的情况
 */
function buildObjectMethodPath(path: NodePath): string[] {
  const result: string[] = [];
  const visitedPaths = new Set<NodePath>();

  // 添加方法名
  if (
    babelTypes.isObjectMethod(path.node) &&
    babelTypes.isIdentifier(path.node.key)
  ) {
    result.unshift(path.node.key.name);
    Logger.trace(`添加对象方法名: ${path.node.key.name}`);
  }

  // 向上查找，构建对象路径
  let current = path.parentPath;

  // 首先找到对象表达式
  while (
    current &&
    !babelTypes.isObjectExpression(current.node) &&
    !visitedPaths.has(current)
  ) {
    visitedPaths.add(current);
    current = current.parentPath;
  }

  // 如果找到了对象表达式，继续向上找对象名
  if (current) {
    let objPath = current;
    let depth = 0;

    while (objPath && depth < 10) {
      // 限制深度防止无限循环
      // eslint-disable-next-line curly
      if (visitedPaths.has(objPath)) break;
      visitedPaths.add(objPath);
      depth++;

      let parentPath = objPath.parentPath;
      // eslint-disable-next-line curly
      if (!parentPath) break;

      // 直接变量声明的对象：const obj = { method() {} }
      if (
        babelTypes.isVariableDeclarator(parentPath.node) &&
        babelTypes.isIdentifier(parentPath.node.id)
      ) {
        result.unshift(parentPath.node.id.name);
        Logger.trace(`添加顶层对象名: ${parentPath.node.id.name}`);
        break;
      }

      // 嵌套在另一个对象里：const obj = { inner: { method() {} } }
      else if (
        babelTypes.isObjectProperty(parentPath.node) &&
        babelTypes.isIdentifier(parentPath.node.key)
      ) {
        result.unshift(parentPath.node.key.name);
        Logger.trace(`添加嵌套对象属性名: ${parentPath.node.key.name}`);

        // 继续向上寻找，可能还有更上层的嵌套
        //@ts-ignore
        objPath = parentPath.parentPath;

        // 如果父级是对象表达式，我们需要再上一级
        if (objPath && babelTypes.isObjectExpression(objPath.node)) {
          continue;
        }
      } else {
        break;
      }
    }
  }

  if (result.length > 0) {
    Logger.debug(`对象方法路径: ${result.join(".")}`);
  }

  return result;
}

/**
 * 专门用于构建类方法的路径
 */
function buildClassMethodPath(path: NodePath): string[] {
  const result: string[] = [];

  // 添加方法名
  if (
    babelTypes.isClassMethod(path.node) &&
    babelTypes.isIdentifier(path.node.key)
  ) {
    result.unshift(path.node.key.name);
    Logger.trace(`添加类方法名: ${path.node.key.name}`);
  }

  // 查找类声明
  const classPath = path.findParent((p) =>
    babelTypes.isClassDeclaration(p.node)
  );
  if (
    classPath &&
    babelTypes.isClassDeclaration(classPath.node) &&
    classPath.node.id
  ) {
    result.unshift(classPath.node.id.name);
    Logger.trace(`添加类名: ${classPath.node.id.name}`);
  }

  return result;
}
// 优化getEnclosingContextName函数以正确处理所有类型的上下文

export function getEnclosingContextName(
  document: vscode.TextDocument,
  position: vscode.Position
): ContextInfo {
  Logger.debug(
    `getEnclosingContextName 被调用，位置: ${position.line}:${position.character}`
  );

  const code = document.getText();
  const offset = document.offsetAt(position);

  let functionName: string | null = null;
  let objectName: string | null = null;
  let path: string[] = [];
  let variableScope: ScopeInfo | null = null;

  try {
    // 使用缓存获取AST和作用域树
    const ast = AstCache.getAst(code, document.fileName);
    const globalScope = AstCache.getScopeTree(code, document.fileName);

    // 查找包含当前位置的最内层作用域
    function findInnerMostScope(
      scope: ScopeInfo,
      position: number
    ): ScopeInfo | null {
      if (position < scope.start || position > scope.end) {
        return null;
      }

      // 先检查当前作用域的变量引用
      for (const variable of scope.variables) {
        if (variable.references.includes(position)) {
          Logger.trace(`找到变量引用: ${variable.name}`);
          return scope;
        }
      }

      Logger.trace(`使用作用域: ${scope.type} (${scope.start}-${scope.end})`);
      return scope;
    }

    variableScope = findInnerMostScope(globalScope, offset);
    if (variableScope) {
      Logger.debug(`最终作用域类型: ${variableScope.type}`);
    }

    // 改进：根据节点类型查找包含当前位置的节点
    let containingFunctionNode: any = null;
    let containingNodePath: NodePath | null = null;
    let processedNodes = new Set<any>();

    traverse(ast, {
      enter(path) {
        const node = path.node;

        // 跳过无位置信息或已处理的节点
        if (
          !node.loc ||
          typeof node.start !== "number" ||
          typeof node.end !== "number" ||
          processedNodes.has(node) ||
          offset < node.start ||
          offset > node.end
        ) {
          return;
        }

        processedNodes.add(node);

        // 检查当前节点是否是函数相关的节点
        if (
          babelTypes.isFunctionDeclaration(node) ||
          babelTypes.isFunctionExpression(node) ||
          babelTypes.isArrowFunctionExpression(node) ||
          babelTypes.isObjectMethod(node) ||
          babelTypes.isClassMethod(node)
        ) {
          // 记录最内层包含当前位置的函数节点
          if (
            !containingFunctionNode ||
            (node.start > containingFunctionNode.start &&
              node.end <= containingFunctionNode.end)
          ) {
            containingFunctionNode = node;
            containingNodePath = path;
            Logger.debug(`找到包含位置的节点: ${node.type}`);
          }
        }
      },
    });

    // 如果找到了包含当前位置的函数节点，处理它
    if (containingNodePath && containingFunctionNode) {
      Logger.debug(`处理节点类型: ${containingFunctionNode.type}`);

      // 处理函数声明
      if (
        babelTypes.isFunctionDeclaration(containingFunctionNode) &&
        containingFunctionNode.id
      ) {
        functionName = containingFunctionNode.id.name;
        Logger.debug(`找到函数声明: ${functionName}`);
      }
      // 处理函数表达式
      else if (
        babelTypes.isFunctionExpression(containingFunctionNode) &&
        //@ts-ignore
        containingNodePath.parent &&
        //@ts-ignore
        babelTypes.isVariableDeclarator(containingNodePath.parent) &&
        //@ts-ignore
        containingNodePath.parent.id &&
        //@ts-ignore
        babelTypes.isIdentifier(containingNodePath.parent.id)
      ) {
        //@ts-ignore
        functionName = containingNodePath.parent.id.name;
        Logger.debug(`找到函数表达式: ${functionName}`);
      }
      // 处理箭头函数
      else if (
        babelTypes.isArrowFunctionExpression(containingFunctionNode) &&
        //@ts-ignore
        containingNodePath.parent &&
        //@ts-ignore
        babelTypes.isVariableDeclarator(containingNodePath.parent) &&
        //@ts-ignore
        containingNodePath.parent.id &&
        //@ts-ignore
        babelTypes.isIdentifier(containingNodePath.parent.id)
      ) {
        //@ts-ignore
        functionName = containingNodePath.parent.id.name;
        Logger.debug(`找到箭头函数: ${functionName}`);
      }
      // 处理对象方法
      else if (
        babelTypes.isObjectMethod(containingFunctionNode) &&
        containingFunctionNode.key &&
        babelTypes.isIdentifier(containingFunctionNode.key)
      ) {
        functionName = containingFunctionNode.key.name;
        Logger.debug(`找到对象方法: ${functionName}`);

        try {
          // 改进：更可靠地构建对象方法的完整路径
          path = buildPathHierarchy(containingNodePath);

          if (path.length >= 1) {
            // 最后一个元素是方法名，前面的都是对象路径
            functionName = path[path.length - 1];

            if (path.length >= 2) {
              // 构建对象名，可能是多级嵌套
              objectName = path.slice(0, path.length - 1).join(".");
              Logger.debug(`解析对象路径: ${objectName}->${functionName}`);
            }
          }
        } catch (pathError) {
          Logger.error("构建路径层次结构时出错:", pathError);
        }
      }
      // 处理类方法
      else if (
        babelTypes.isClassMethod(containingFunctionNode) &&
        containingFunctionNode.key &&
        babelTypes.isIdentifier(containingFunctionNode.key)
      ) {
        functionName = containingFunctionNode.key.name;
        Logger.debug(`找到类方法: ${functionName}`);
        //@ts-ignore
        const classPath = containingNodePath.findParent((p) =>
          babelTypes.isClassDeclaration(p.node)
        );
        if (
          classPath &&
          babelTypes.isClassDeclaration(classPath.node) &&
          classPath.node.id
        ) {
          objectName = classPath.node.id.name;
          Logger.debug(`找到类名: ${objectName}`);
          if (objectName === null) {
            Logger.error("类名未定义");
          }
          // 构建完整路径数组
          //@ts-ignore
          path = [objectName, functionName];
        }
      }
    }

    // 恢复日志级别

    Logger.info(
      `返回上下文信息: ${objectName ? objectName + "->" : ""}${functionName}`
    );
    return { functionName, objectName, path, variableScope };
  } catch (e) {
    Logger.error("getEnclosingContextName 解析错误:", e);
    return {
      functionName: null,
      objectName: null,
      path: [],
      variableScope: null,
    };
  }
}

// 优化后的findValidInsertionPoint函数
export function findValidInsertionPoint(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  variableName: string
): InsertionPosition | null {
  Logger.debug(`findValidInsertionPoint 被调用，变量: ${variableName}`);
  const code = document.getText();
  const selectedPosition = document.offsetAt(selection.start);

  try {
    // 使用缓存获取AST和作用域树
    const ast = AstCache.getAst(code, document.fileName);
    const globalScope = AstCache.getScopeTree(code, document.fileName);

    // 查找变量声明和作用域
    let variableInfo: VariableInfo | null = null;
    let containingScope: ScopeInfo | null = null;

    // 查找包含选中位置的作用域
    function findScopeContainingPosition(
      scope: ScopeInfo,
      position: number
    ): ScopeInfo | null {
      if (position < scope.start || position > scope.end) {
        return null;
      }

      Logger.trace(`当前作用域 ${scope.type} 包含目标位置`);
      return scope;
    }

    // 查找变量，更高效的版本
    function findVariableInAllScopes(
      scope: ScopeInfo | null,
      name: string
    ): [VariableInfo | null, ScopeInfo | null] {
      // 遍历作用域链查找变量
      let currentScope = scope;
      while (currentScope) {
        // 优化：直接从Map中查找变量
        if (currentScope.variableMap && currentScope.variableMap.has(name)) {
          const variable = currentScope.variableMap.get(name)!;
          Logger.debug(`找到变量 ${name} 在 ${currentScope.type} 作用域`);
          return [variable, currentScope];
        }
        currentScope = currentScope.parent;
      }

      Logger.trace(`未在作用域链中找到变量 ${name}`);
      return [null, null];
    }

    // 1. 首先尝试在标准作用域中查找变量
    const currentScope = findScopeContainingPosition(
      globalScope,
      selectedPosition
    );
    if (currentScope) {
      [variableInfo, containingScope] = findVariableInAllScopes(
        currentScope,
        variableName
      );
    }

    // 2. 特殊处理：对于对象方法内的变量
    if (!variableInfo) {
      Logger.debug(`尝试在对象方法中查找变量 ${variableName}`);

      // 对象方法处理，使用缓存避免重复计算
      const objectMethods = new Map<any, any>(); // 节点缓存

      traverse(ast, {
        ObjectMethod(path) {
          const node = path.node;

          // 如果已处理过相同节点，跳过
          if (objectMethods.has(node)) {
            return;
          }
          objectMethods.set(node, true);

          // 快速去除不相关节点
          if (
            node.start === null ||
            node.end === null ||
            node.start === undefined ||
            node.end === undefined
          ) {
            return;
          }

          if (
            !node.loc ||
            selectedPosition < node.start ||
            selectedPosition > node.end
          ) {
            return;
          }
          //@ts-ignore
          Logger.trace(`检查对象方法: ${node.key?.name || "匿名"}`);
          const body = node.body;

          if (babelTypes.isBlockStatement(body)) {
            // 优先查找完整变量声明语句
            for (const stmt of body.body) {
              if (babelTypes.isVariableDeclaration(stmt)) {
                for (const decl of stmt.declarations) {
                  if (
                    babelTypes.isIdentifier(decl.id) &&
                    decl.id.name === variableName
                  ) {
                    Logger.debug(`在对象方法内找到变量: ${variableName}`);
                    // 使用整个变量声明语句的结束位置，而不仅是变量名
                    const insertPosition = document.positionAt(stmt.end || 0);
                    variableInfo = {
                      name: variableName,
                      declarationStart: decl.id.start || 0,
                      // 使用整个语句的结束位置，确保包含了变量初始化部分
                      declarationEnd: stmt.end || 0,
                      references: [],
                      isParameter: false,
                    };
                    containingScope = {
                      variables: [variableInfo],
                      parent: null,
                      type: "method",
                      start: body.start || 0,
                      end: body.end || 0,
                      node: body,
                      variableMap: new Map([[variableName, variableInfo]]),
                    };
                  }
                }
              }
            }
          }
        },
      });
    }

    // 如果找到变量和作用域，返回声明后的位置
    if (variableInfo && containingScope) {
      const declarationPosition = document.positionAt(
        variableInfo.declarationEnd
      );
      Logger.debug(
        `在变量声明后找到插入位置: 行 ${declarationPosition.line}, 列 ${declarationPosition.character}`
      );

      return {
        line: declarationPosition.line,
        character: declarationPosition.character,
        isEndOfStatement: true,
        scopeStart: containingScope.start,
        scopeEnd: containingScope.end,
      };
    }

    // 3. 作为备选，使用AST遍历找位置
    Logger.debug(`使用AST遍历查找插入位置`);
    let validPosition: InsertionPosition | null = null;
    let lastStatementEnd = 0;

    // 使用节点类型过滤，减少不必要的处理
    const relevantNodeTypes = new Set([
      "VariableDeclarator",
      "ArrowFunctionExpression",
      "FunctionExpression",
      "VariableDeclaration",
      "ExpressionStatement",
      "ObjectMethod", // 特别关注对象方法
    ]);

    traverse(ast, {
      enter(path) {
        const node = path.node;

        // 快速过滤不相关节点
        if (
          !node.type ||
          !relevantNodeTypes.has(node.type) ||
          !node.loc ||
          typeof node.start !== "number" ||
          typeof node.end !== "number" ||
          node.start === null ||
          node.start === undefined ||
          node.end === null ||
          node.end === undefined ||
          (node.start !== null &&
            node.start !== undefined &&
            selectedPosition < node.start) ||
          (node.end !== null &&
            node.end !== undefined &&
            selectedPosition > node.end)
        ) {
          return;
        }

        Logger.trace(`处理 ${node.type} 节点`);

        // 修改findValidInsertionPoint函数中对变量声明的处理
        if (
          babelTypes.isVariableDeclarator(node) &&
          babelTypes.isIdentifier(node.id) &&
          node.id.name === variableName
        ) {
          // 查找父级VariableDeclaration，获取整个声明语句的结束位置
          const declarationPath = path.findParent((p) =>
            babelTypes.isVariableDeclaration(p.node)
          );

          if (
            declarationPath &&
            declarationPath.node &&
            typeof declarationPath.node.end === "number"
          ) {
            const insertPosition = document.positionAt(
              declarationPath.node.end
            );
            validPosition = {
              line: insertPosition.line,
              character: insertPosition.character,
              isEndOfStatement: true,
              scopeStart: path.scope?.block?.start ?? undefined,
              scopeEnd: path.scope?.block?.end ?? undefined,
            };
            Logger.debug(
              `找到完整变量声明插入位置: ${insertPosition.line}:${insertPosition.character}`
            );
          } else {
            // 回退到原始行为但也尝试获取完整语句
            const parentStatement = path.getStatementParent();
            if (
              parentStatement &&
              typeof parentStatement.node.end === "number"
            ) {
              const insertPosition = document.positionAt(
                parentStatement.node.end
              );
              validPosition = {
                line: insertPosition.line,
                character: insertPosition.character,
                isEndOfStatement: true,
                scopeStart: path.scope?.block?.start ?? undefined,
                scopeEnd: path.scope?.block?.end ?? undefined,
              };
              Logger.debug(
                `使用父语句结束位置: ${insertPosition.line}:${insertPosition.character}`
              );
            } else {
              // 最后的回退策略
              const insertPosition = document.positionAt(node.end);
              validPosition = {
                line: insertPosition.line,
                character: insertPosition.character,
                isEndOfStatement: true,
                scopeStart: path.scope?.block?.start ?? undefined,
                scopeEnd: path.scope?.block?.end ?? undefined,
              };
              Logger.debug(
                `找到变量声明插入位置(回退): ${insertPosition.line}:${insertPosition.character}`
              );
            }
          }
        }

        // 特别处理对象方法中的变量
        if (babelTypes.isObjectMethod(node)) {
          if (babelTypes.isBlockStatement(node.body)) {
            for (const stmt of node.body.body) {
              if (babelTypes.isVariableDeclaration(stmt)) {
                for (const decl of stmt.declarations) {
                  if (
                    babelTypes.isIdentifier(decl.id) &&
                    decl.id.name === variableName
                  ) {
                    // 确保我们获取整个变量声明语句的结束位置
                    const insertPosition = document.positionAt(stmt.end || 0);
                    validPosition = {
                      line: insertPosition.line,
                      character: insertPosition.character,
                      isEndOfStatement: true,
                      scopeStart: node.body.start || 0,
                      scopeEnd: node.body.end || 0,
                    };
                    Logger.debug(
                      `在对象方法中找到变量插入位置: ${insertPosition.line}:${insertPosition.character}`
                    );
                  }
                }
              }
            }
          }
        }

        // 处理函数内的变量
        if (
          (babelTypes.isArrowFunctionExpression(node) ||
            babelTypes.isFunctionExpression(node)) &&
          node.body &&
          babelTypes.isBlockStatement(node.body)
        ) {
          Logger.trace(`检查函数体中的变量`);

          for (const stmt of node.body.body) {
            if (!stmt.end) {
              continue;
            }
            if (babelTypes.isVariableDeclaration(stmt)) {
              for (const decl of stmt.declarations) {
                if (
                  babelTypes.isIdentifier(decl.id) &&
                  decl.id.name === variableName
                ) {
                  const insertPosition = document.positionAt(stmt.end);
                  validPosition = {
                    line: insertPosition.line,
                    character: insertPosition.character,
                    isEndOfStatement: true,
                    scopeStart: node.body.start ?? undefined,
                    scopeEnd: node.body.end ?? undefined,
                  };
                  Logger.debug(
                    `找到函数变量插入位置: ${insertPosition.line}:${insertPosition.character}`
                  );
                }
              }
            }
          }
        }

        // 更新最后一条语句的结束位置
        if (
          (babelTypes.isVariableDeclaration(node) ||
            babelTypes.isExpressionStatement(node)) &&
          node.end > lastStatementEnd
        ) {
          lastStatementEnd = node.end;
        }
      },
    });

    // 如果没有找到更好的位置，使用最后语句结束位置
    if (!validPosition && lastStatementEnd > 0) {
      const insertPosition = document.positionAt(lastStatementEnd);
      validPosition = {
        line: insertPosition.line,
        character: insertPosition.character,
        isEndOfStatement: true,
      };
      Logger.debug(
        `使用最后语句位置: ${insertPosition.line}:${insertPosition.character}`
      );
    }

    // 最后的备选：行末
    if (!validPosition) {
      const line = document.lineAt(selection.end.line);
      validPosition = {
        line: selection.end.line,
        character: line.text.length,
        isEndOfStatement: false,
      };
      Logger.debug(`使用行末位置: ${selection.end.line}:${line.text.length}`);
    }

    return validPosition;
  } catch (e) {
    Logger.error(`处理 ${variableName} 时出错:`, e);

    // 出错时回退到行末
    try {
      const line = document.lineAt(selection.end.line);
      return {
        line: selection.end.line,
        character: line.text.length,
        isEndOfStatement: false,
      };
    } catch (fallbackError) {
      Logger.error("回退到行末失败:", fallbackError);
      return null;
    }
  }
}

// 优化后的getVariableDefinition函数
export function getVariableDefinition(
  document: vscode.TextDocument,
  position: vscode.Position,
  variableName: string
): VariableInfo | null {
  Logger.debug(`getVariableDefinition 被调用，变量: ${variableName}`);
  const code = document.getText();
  const offset = document.offsetAt(position);

  try {
    // 使用缓存
    const ast = AstCache.getAst(code, document.fileName);
    const globalScope = AstCache.getScopeTree(code, document.fileName);

    // 查找包含位置的最内层作用域
    function findScopeAtPosition(
      scope: ScopeInfo,
      position: number
    ): ScopeInfo | null {
      if (position < scope.start || position > scope.end) {
        return null;
      }

      return scope;
    }

    const currentScope = findScopeAtPosition(globalScope, offset);
    if (!currentScope) {
      Logger.debug("未找到包含当前位置的作用域");
      return null;
    }

    // 在当前作用域及其父作用域中查找变量，使用Map优化
    let scope: ScopeInfo | null = currentScope;
    while (scope) {
      // 优化：使用Map直接查找变量
      if (scope.variableMap && scope.variableMap.has(variableName)) {
        const variable = scope.variableMap.get(variableName);
        Logger.debug(`在 ${scope.type} 作用域中找到变量 ${variableName}`);
        return variable!;
      }
      scope = scope.parent;
    }

    Logger.debug(`未找到变量 ${variableName}`);
    return null;
  } catch (e) {
    Logger.error(`getVariableDefinition 解析错误:`, e);
    return null;
  }
}

// 调试函数，保留原功能
export function debugCodeAnalysis(
  document: vscode.TextDocument,
  position: vscode.Position,
  variableName: string
): void {
  Logger.info("=================== 代码分析调试开始 ===================");
  Logger.info(`文件: ${document.fileName}`);
  Logger.info(`位置: 行 ${position.line}, 列 ${position.character}`);
  Logger.info(`变量名: ${variableName}`);

  try {
    const code = document.getText();
    const offset = document.offsetAt(position);
    const ast = AstCache.getAst(code, document.fileName);
    const globalScope = AstCache.getScopeTree(code, document.fileName);

    Logger.info("作用域树构建完成:");
    Logger.info(`全局作用域包含 ${globalScope.variables.length} 个变量`);

    const contextInfo = getEnclosingContextName(document, position);
    Logger.info(
      "上下文信息:",
      JSON.stringify(
        {
          functionName: contextInfo.functionName,
          objectName: contextInfo.objectName,
          path: contextInfo.path,
          hasScope: !!contextInfo.variableScope,
        },
        null,
        2
      )
    );

    const varDef = getVariableDefinition(document, position, variableName);
    Logger.info(
      "变量定义:",
      varDef
        ? `找到变量 ${varDef.name} (${varDef.isParameter ? "参数" : "变量"})`
        : `未找到变量 ${variableName}`
    );

    const insertPoint = findValidInsertionPoint(
      document,
      new vscode.Selection(position, position),
      variableName
    );
    Logger.info(
      "插入点:",
      insertPoint
        ? `行 ${insertPoint.line}, 列 ${insertPoint.character}`
        : "未找到合适插入点"
    );

    Logger.info("=================== 代码分析调试结束 ===================");
  } catch (error) {
    Logger.error("调试过程出错:", error);
  }
}

// 专门用于调试对象方法的函数
export function debugObjectMethodAnalysis(
  document: vscode.TextDocument,
  position: vscode.Position,
  variableName: string
): void {
  Logger.info("=================== 对象方法分析开始 ===================");

  try {
    const code = document.getText();
    const offset = document.offsetAt(position);
    const ast = AstCache.getAst(code, document.fileName);

    // 使用Set记录已处理过的节点，避免重复分析
    const processedNodes = new Set();

    // 单独分析对象方法
    traverse(ast, {
      ObjectMethod(path) {
        const node = path.node;
        if (!node.loc || processedNodes.has(node)) {
          return;
        }
        processedNodes.add(node);

        // 检查位置是否在当前对象方法内
        //@ts-ignore
        if (offset >= node.start && offset <= node.end) {
          //@ts-ignore
          Logger.info(`[找到] 对象方法: ${node.key?.name || "匿名"}`);

          // 获取对象名信息
          //@ts-ignore
          let objPath = path.parentPath;
          while (objPath && !babelTypes.isObjectExpression(objPath.node)) {
            objPath = objPath.parentPath;
          }

          if (objPath && objPath.parent) {
            if (
              babelTypes.isVariableDeclarator(objPath.parent) &&
              babelTypes.isIdentifier(objPath.parent.id)
            ) {
              Logger.info(`[找到] 对象名: ${objPath.parent.id.name}`);
            }
          }

          // 检查方法内变量
          if (babelTypes.isBlockStatement(node.body)) {
            Logger.info(
              `[分析] 方法体范围: ${node.body.start}-${node.body.end}`
            );

            for (const stmt of node.body.body) {
              if (babelTypes.isVariableDeclaration(stmt)) {
                for (const decl of stmt.declarations) {
                  if (babelTypes.isIdentifier(decl.id)) {
                    Logger.info(
                      `[发现] 变量: ${decl.id.name} 位置:${decl.id.start}-${decl.id.end}`
                    );

                    if (decl.id.name === variableName) {
                      Logger.info(`[匹配] 找到目标变量: ${variableName}`);
                    }
                  }
                }
              }
            }
          }

          // 构建一次路径来测试
          //@ts-ignore
          const path = buildPathHierarchy(path);
          Logger.info(`[路径测试] 构建路径结果: ${path.join(".")}`);
        }
      },
    });

    Logger.info("=================== 对象方法分析结束 ===================");
  } catch (error) {
    Logger.error("对象方法分析出错:", error);
  }
}

// 添加导出函数，用于控制日志级别
export function setLogLevel(level: LogLevel) {
  Logger.setLevel(level);
  console.log(`[LOGRUSH] 日志级别已设置为: ${LogLevel[level]}`);
}

// 添加导出函数，用于清除缓存
export function clearAnalyzerCache(fileName?: string) {
  AstCache.clearCache(fileName);
}
