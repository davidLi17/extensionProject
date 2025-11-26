import * as vscode from "vscode";
import { Logger } from "../core/logger";
import { AstCache } from "../core/astCache";
import { getEnclosingContextName } from "./contextAnalyzer";
import { findValidInsertionPoint, getVariableDefinition } from "..";
import traverse, { NodePath } from "@babel/traverse";
import * as babelTypes from "@babel/types";
import { buildPathHierarchy } from "./pathAnalyzer";

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
      ObjectMethod(nodePath) {
        const node = nodePath.node;
        if (!node.loc || processedNodes.has(node)) {
          return;
        }
        processedNodes.add(node);

        // 检查位置是否在当前对象方法内

        if (offset >= node.start && offset <= node.end) {
          Logger.info(`[找到] 对象方法: ${node.key?.name || "匿名"}`);

          // 获取对象名信息

          let objPath = nodePath.parentPath;
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

          const path = buildPathHierarchy(nodePath);
          Logger.info(`[路径测试] 构建路径结果: ${path.join(".")}`);
        }
      },
    });

    Logger.info("=================== 对象方法分析结束 ===================");
  } catch (error) {
    Logger.error("对象方法分析出错:", error);
  }
}
