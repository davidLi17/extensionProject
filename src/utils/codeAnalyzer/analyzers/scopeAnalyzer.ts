import * as vscode from "vscode";
import * as parser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import * as babelTypes from "@babel/types";
import {
  ScopeInfo,
  VariableInfo,
  ContextInfo,
  InsertionPosition,
  LogLevel,
} from "../types";
// 判断是否需要创建新作用域
export function createNewScope(path: NodePath) {
  const node = path.node;
  return (
    babelTypes.isFunction(node) ||
    babelTypes.isBlockStatement(node) ||
    babelTypes.isObjectMethod(node) ||
    babelTypes.isClassMethod(node)
  );
}

// 获取作用域类型
export function getScopeType(
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
export function collectFunctionParams(path: NodePath, scope: ScopeInfo) {
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
