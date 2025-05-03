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
import { Logger } from "../core/logger";
import { AstCache } from "../core/astCache";
import { buildPathHierarchy } from "./pathAnalyzer";
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
        containingNodePath.parent &&
        babelTypes.isVariableDeclarator(containingNodePath.parent) &&
        containingNodePath.parent.id &&
        babelTypes.isIdentifier(containingNodePath.parent.id)
      ) {
        functionName = containingNodePath.parent.id.name;
        Logger.debug(`找到函数表达式: ${functionName}`);
      }
      // 处理箭头函数
      else if (
        babelTypes.isArrowFunctionExpression(containingFunctionNode) &&
        containingNodePath.parent &&
        babelTypes.isVariableDeclarator(containingNodePath.parent) &&
        containingNodePath.parent.id &&
        babelTypes.isIdentifier(containingNodePath.parent.id)
      ) {
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
