import { ContextInfo } from "../types";
import * as vscode from "vscode";
import { NodePath } from "@babel/traverse";
import * as babelTypes from "@babel/types";
// 判断是否是变量声明
export function isDeclaration(path: NodePath): boolean {
	const parent = path.parent;

	return (
		(babelTypes.isVariableDeclarator(parent) && path.node === parent.id) ||
		// @ts-ignore - Function类型不包含id属性
		(babelTypes.isFunction(parent) && parent.id && path.node === parent.id) ||
		(babelTypes.isFunction(parent) &&
			// @ts-ignore - 参数类型检查问题
			Array.isArray(parent.params) &&
			//@ts-ignore
			parent.params.includes(path.node))
	);
}
