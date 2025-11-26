import { ContextInfo } from "../types";
import * as vscode from "vscode";
import { NodePath } from "@babel/traverse";
import * as babelTypes from "@babel/types";
// 判断是否是变量声明
export function isDeclaration(path: NodePath): boolean {
  const parent = path.parent;
  const node = path.node;

  // 检查是否是变量声明的 id
  if (babelTypes.isVariableDeclarator(parent) && node === parent.id) {
    return true;
  }

  // 检查是否是函数声明/表达式的 id
  if (
    (babelTypes.isFunctionDeclaration(parent) ||
      babelTypes.isFunctionExpression(parent)) &&
    parent.id &&
    node === parent.id
  ) {
    return true;
  }

  // 检查是否是函数参数
  if (
    babelTypes.isFunction(parent) &&
    Array.isArray(parent.params) &&
    babelTypes.isIdentifier(node) &&
    parent.params.some(
      (param) => babelTypes.isIdentifier(param) && param === node
    )
  ) {
    return true;
  }

  return false;
}
