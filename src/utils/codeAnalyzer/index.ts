import * as vscode from "vscode";
import traverse, { NodePath } from "@babel/traverse";
import * as babelTypes from "@babel/types";
import { ScopeInfo, VariableInfo, InsertionPosition, LogLevel } from "./types";
import { Logger } from "./core/logger";
import { AstCache } from "./core/astCache";

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
// 添加导出函数，用于控制日志级别
export function setLogLevel(level: LogLevel) {
  Logger.setLevel(level);
  console.log(`[LOGRUSH] 日志级别已设置为: ${LogLevel[level]}`);
}

// 添加导出函数，用于清除缓存
export function clearAnalyzerCache(fileName?: string) {
  AstCache.clearCache(fileName);
}
export { LogLevel };
