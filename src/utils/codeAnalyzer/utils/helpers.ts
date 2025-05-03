import { ContextInfo } from "../types";
import * as vscode from "vscode";
import { NodePath } from "@babel/traverse";
import * as babelTypes from "@babel/types";
// 判断是否是变量声明
export function isDeclaration(path: NodePath): boolean {
  const parent = path.parent;

  return (
    (babelTypes.isVariableDeclarator(parent) && path.node === parent.id) ||
    (babelTypes.isFunction(parent) && parent.id && path.node === parent.id) ||
    (babelTypes.isFunction(parent) &&
      Array.isArray(parent.params) &&
      parent.params.includes(path.node))
  );
}
