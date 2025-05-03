import * as parser from "@babel/parser";
import { Logger } from "./logger";
import { ScopeInfo, VariableInfo } from "../types";
import traverse, { NodePath } from "@babel/traverse";
import {
  collectFunctionParams,
  createNewScope,
  getScopeType,
} from "../analyzers/scopeAnalyzer";
import * as babelTypes from "@babel/types";

// 优化解析代码生成AST的通用函数
export function parseCode(code: string, fileName: string) {
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
export function buildScopeTree(ast: any) {
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
      //@ts-ignore
      if (babelTypes.isIdentifier(node) && !babelTypes.isDeclaration(path)) {
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
