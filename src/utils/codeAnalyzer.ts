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

// 解析代码生成AST的通用函数
function parseCode(code: string, fileName: string) {
  const sourceType =
    fileName.endsWith(".tsx") || fileName.endsWith(".jsx")
      ? "script"
      : "module";

  return parser.parse(code, {
    sourceType: sourceType as "module" | "script" | "unambiguous",
    plugins: ["typescript", "jsx", "decorators-legacy", "classProperties"],
  });
}

function buildScopeTree(ast: any) {
  const globalScope: ScopeInfo = {
    variables: [],
    parent: null,
    type: "global",
    start: 0,
    end: Infinity,
    node: null,
  };

  let currentScope = globalScope;
  const scopeStack: ScopeInfo[] = [globalScope];

  traverse(ast, {
    enter(path) {
      const node = path.node;

      // 跳过没有位置信息的节点
      if (
        !node.loc ||
        typeof node.start !== "number" ||
        typeof node.end !== "number"
      ) {
        return;
      }

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
        };

        scopeStack.push(newScope);
        currentScope = newScope;

        // 收集函数参数作为变量
        collectFunctionParams(path, currentScope);
      }

      // 特殊处理对象方法
      if (babelTypes.isObjectMethod(node)) {
        console.log(`[调试] 处理对象方法: ${node.key?.name || "匿名"}`);
        // 确保对象方法获得正确的作用域
        const methodScope: ScopeInfo = {
          variables: [],
          parent: currentScope,
          type: "method",
          start: node.start || 0,
          end: node.end || Infinity,
          node: node,
        };

        scopeStack.push(methodScope);
        currentScope = methodScope;

        // 收集对象方法参数
        if (node.params) {
          for (const param of node.params) {
            if (babelTypes.isIdentifier(param)) {
              currentScope.variables.push({
                name: param.name,
                declarationStart: param.start || node.start || 0,
                declarationEnd: param.end || node.start || 0,
                references: [],
                isParameter: true,
              });
            }
          }
        }
      }

      // 收集变量声明
      if (babelTypes.isVariableDeclaration(node)) {
        for (const declarator of node.declarations) {
          if (babelTypes.isIdentifier(declarator.id)) {
            currentScope.variables.push({
              name: declarator.id.name,
              declarationStart: declarator.start || node.start,
              declarationEnd: declarator.end || node.end,
              references: [],
              isParameter: false,
            });
          }
        }
      }

      // 收集变量引用
      if (babelTypes.isIdentifier(node) && !isDeclaration(path)) {
        const varName = node.name;
        // 查找最近的包含此变量定义的作用域
        let scope: ScopeInfo | null = currentScope;
        while (scope) {
          const variable = scope.variables.find((v) => v.name === varName);
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
        scope.variables.push({
          name: param.name,
          declarationStart: param.start ?? node.start ?? 0,
          declarationEnd: param.end ?? node.start ?? 0,
          references: [],
          isParameter: true,
        });
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

function buildPathHierarchy(path: NodePath): string[] {
  const result: string[] = [];
  console.log(`[调试] 开始构建路径层次，节点类型: ${path.node.type}`);

  let current: NodePath | null = path;
  while (current) {
    // 处理对象方法
    if (
      babelTypes.isObjectMethod(current.node) &&
      babelTypes.isIdentifier(current.node.key)
    ) {
      result.unshift(current.node.key.name);
      console.log(`[路径] 添加对象方法名: ${current.node.key.name}`);

      // 查找对象表达式
      let objPath = current.parentPath;
      while (objPath && !babelTypes.isObjectExpression(objPath.node)) {
        objPath = objPath.parentPath;
      }

      // 处理对象名称
      if (objPath && objPath.parent) {
        if (
          babelTypes.isVariableDeclarator(objPath.parent) &&
          babelTypes.isIdentifier(objPath.parent.id)
        ) {
          result.unshift(objPath.parent.id.name);
          console.log(`[路径] 添加变量声明对象名: ${objPath.parent.id.name}`);
        } else if (
          babelTypes.isObjectProperty(objPath.parent) &&
          babelTypes.isIdentifier(objPath.parent.key)
        ) {
          result.unshift(objPath.parent.key.name);
          console.log(`[路径] 添加对象属性名: ${objPath.parent.key.name}`);

          // 处理嵌套对象
          let parentObjPath = objPath.parentPath;
          while (parentObjPath) {
            if (
              babelTypes.isObjectProperty(parentObjPath.node) &&
              babelTypes.isIdentifier(parentObjPath.node.key)
            ) {
              result.unshift(parentObjPath.node.key.name);
              console.log(
                `[路径] 添加嵌套对象属性名: ${parentObjPath.node.key.name}`
              );
            } else if (
              babelTypes.isVariableDeclarator(parentObjPath.node) &&
              babelTypes.isIdentifier(parentObjPath.node.id)
            ) {
              result.unshift(parentObjPath.node.id.name);
              console.log(
                `[路径] 添加顶层变量名: ${parentObjPath.node.id.name}`
              );
              break;
            }
            parentObjPath = parentObjPath.parentPath;
          }
        }
      } else {
        console.log("[警告] 无法找到对象方法的父对象");
      }
      break;
    }

    // 处理类方法
    else if (
      babelTypes.isClassMethod(current.node) &&
      babelTypes.isIdentifier(current.node.key)
    ) {
      result.unshift(current.node.key.name);
      console.log(`[路径] 添加类方法名: ${current.node.key.name}`);

      // 查找类声明
      const classPath = current.findParent((p) =>
        babelTypes.isClassDeclaration(p.node)
      );
      if (
        classPath &&
        babelTypes.isClassDeclaration(classPath.node) &&
        classPath.node.id
      ) {
        result.unshift(classPath.node.id.name);
        console.log(`[路径] 添加类名: ${classPath.node.id.name}`);
      }
      break;
    }

    // 处理函数声明/表达式
    else if (
      (babelTypes.isFunctionDeclaration(current.node) ||
        babelTypes.isFunctionExpression(current.node)) &&
      current.node.id &&
      babelTypes.isIdentifier(current.node.id)
    ) {
      result.unshift(current.node.id.name);
      console.log(`[路径] 添加函数名: ${current.node.id.name}`);
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
        console.log(`[路径] 添加箭头函数变量名: ${current.parent.id.name}`);
      }
      break;
    }

    current = current.parentPath;
  }

  console.log(`[路径] 最终构建路径: ${result.join(".")}`);
  return result;
}

export function getEnclosingContextName(
  document: vscode.TextDocument,
  position: vscode.Position
): ContextInfo {
  console.log(
    `[调试] getEnclosingContextName 被调用，位置: ${position.line}:${position.character}`
  );

  const code = document.getText();
  const offset = document.offsetAt(position);

  let functionName: string | null = null;
  let objectName: string | null = null;
  let path: string[] = [];
  let variableScope: ScopeInfo | null = null;

  try {
    const ast = parseCode(code, document.fileName);
    const globalScope = buildScopeTree(ast);

    // 查找包含当前位置的最内层作用域
    function findInnerMostScope(
      scope: ScopeInfo,
      position: number
    ): ScopeInfo | null {
      if (position < scope.start || position > scope.end) {
        return null;
      }

      // 查找子作用域
      for (const variable of scope.variables) {
        if (variable.references.includes(position)) {
          console.log(`[作用域] 找到变量引用: ${variable.name}`);
          return scope;
        }
      }

      console.log(
        `[作用域] 使用作用域: ${scope.type} (${scope.start}-${scope.end})`
      );
      return scope;
    }

    variableScope = findInnerMostScope(globalScope, offset);
    if (variableScope) {
      console.log(`[作用域] 最终作用域类型: ${variableScope.type}`);
    }

    traverse(ast, {
      enter(path) {
        const node = path.node;

        // 跳过没有位置信息的节点
        if (
          !node.loc ||
          typeof node.start !== "number" ||
          typeof node.end !== "number"
        ) {
          return;
        }

        // 检查节点是否包含目标位置
        if (offset >= node.start && offset <= node.end) {
          console.log(`[节点] 处理节点类型: ${node.type}`);

          // 处理函数声明
          if (babelTypes.isFunctionDeclaration(node) && node.id) {
            functionName = node.id.name;
            console.log(`[函数] 找到函数声明: ${functionName}`);
          }
          // 处理函数表达式
          else if (
            babelTypes.isFunctionExpression(node) &&
            path.parent &&
            babelTypes.isVariableDeclarator(path.parent) &&
            path.parent.id &&
            babelTypes.isIdentifier(path.parent.id)
          ) {
            functionName = path.parent.id.name;
            console.log(`[函数] 找到函数表达式: ${functionName}`);
          }
          // 处理箭头函数
          else if (
            babelTypes.isArrowFunctionExpression(node) &&
            path.parent &&
            babelTypes.isVariableDeclarator(path.parent) &&
            path.parent.id &&
            babelTypes.isIdentifier(path.parent.id)
          ) {
            functionName = path.parent.id.name;
            console.log(`[函数] 找到箭头函数: ${functionName}`);
          }
          // 处理对象方法
          else if (
            babelTypes.isObjectMethod(node) &&
            node.key &&
            babelTypes.isIdentifier(node.key)
          ) {
            functionName = node.key.name;
            console.log(`[对象] 找到对象方法: ${functionName}`);

            try {
              // 构建完整的层级路径
              const hierarchyPath = buildPathHierarchy(path);
              //@ts-ignore
              path = hierarchyPath;

              if (hierarchyPath.length >= 2) {
                objectName = hierarchyPath[0]; // 第一个元素应该是对象名
                functionName = hierarchyPath[1]; // 第二个元素是方法名
                console.log(
                  `[对象] 解析对象路径: ${objectName}.${functionName}`
                );
              }
            } catch (pathError) {
              console.error("[错误] 构建路径层次结构时出错:", pathError);
            }
          }
          // 处理类方法
          else if (
            babelTypes.isClassMethod(node) &&
            node.key &&
            babelTypes.isIdentifier(node.key)
          ) {
            functionName = node.key.name;
            console.log(`[类] 找到类方法: ${functionName}`);

            const classPath = path.findParent((p) =>
              babelTypes.isClassDeclaration(p.node)
            );
            if (
              classPath &&
              babelTypes.isClassDeclaration(classPath.node) &&
              classPath.node.id
            ) {
              objectName = classPath.node.id.name;
              console.log(`[类] 找到类名: ${objectName}`);
            }
          }
        }
      },
    });

    console.log(
      `[结果] 返回上下文信息: ${
        objectName ? objectName + "." : ""
      }${functionName}`
    );
    return { functionName, objectName, path, variableScope };
  } catch (e) {
    console.error("getEnclosingContextName 解析错误:", e);
    return {
      functionName: null,
      objectName: null,
      path: [],
      variableScope: null,
    };
  }
}

export function findValidInsertionPoint(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  variableName: string
): InsertionPosition | null {
  console.log(`[调试] findValidInsertionPoint 被调用，变量: ${variableName}`);
  const code = document.getText();
  const selectedPosition = document.offsetAt(selection.start);

  try {
    const ast = parseCode(code, document.fileName);
    const globalScope = buildScopeTree(ast);

    // 查找变量声明和作用域
    let variableInfo: VariableInfo | null = null;
    let containingScope: ScopeInfo | null = null;

    // 改进的变量查找函数
    function findVariableInScope(
      scope: ScopeInfo,
      name: string
    ): [VariableInfo | null, ScopeInfo | null] {
      console.log(
        `[作用域] 在 ${scope.type} 作用域(位置:${scope.start}-${scope.end})查找变量: ${name}`
      );

      // 检查当前作用域
      const variable = scope.variables.find((v) => v.name === name);
      if (variable) {
        console.log(`[成功] 找到变量 ${name} 在 ${scope.type} 作用域`);
        return [variable, scope];
      }

      return [null, null];
    }

    // 递归查找变量，包括父作用域
    function findVariableInAllScopes(
      scope: ScopeInfo,
      name: string
    ): [VariableInfo | null, ScopeInfo | null] {
      const [foundVar, foundScope] = findVariableInScope(scope, name);
      if (foundVar) {
        return [foundVar, foundScope];
      }

      if (scope.parent) {
        console.log(`[递归] 在父作用域继续查找变量 ${name}`);
        return findVariableInAllScopes(scope.parent, name);
      }

      console.log(`[警告] 未在任何作用域找到变量 ${name}`);
      return [null, null];
    }

    // 查找包含选中位置的作用域
    function findScopeContainingPosition(
      scope: ScopeInfo,
      position: number
    ): ScopeInfo | null {
      if (position < scope.start || position > scope.end) {
        return null;
      }

      console.log(`[作用域] 当前作用域 ${scope.type} 包含目标位置`);
      return scope;
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
      console.log(`[特殊处理] 尝试在对象方法中查找变量 ${variableName}`);
      traverse(ast, {
        ObjectMethod(path) {
          const node = path.node;
          if (
            !node.loc ||
            selectedPosition < node.start ||
            selectedPosition > node.end
          ) {
            return;
          }

          console.log(`[对象方法] 检查方法: ${node.key?.name || "匿名"}`);
          const body = node.body;
          if (babelTypes.isBlockStatement(body)) {
            for (const stmt of body.body) {
              if (babelTypes.isVariableDeclaration(stmt)) {
                for (const decl of stmt.declarations) {
                  if (
                    babelTypes.isIdentifier(decl.id) &&
                    decl.id.name === variableName
                  ) {
                    console.log(`[成功] 在对象方法内找到变量: ${variableName}`);
                    variableInfo = {
                      name: variableName,
                      declarationStart: decl.id.start || 0,
                      declarationEnd: decl.id.end || 0,
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
      console.log(
        `[插入位置] 在变量声明后: 行 ${declarationPosition.line}, 列 ${declarationPosition.character}`
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
    console.log(`[备选方案] 使用AST遍历查找插入位置`);
    let validPosition: InsertionPosition | null = null;
    let lastStatementEnd = 0;

    traverse(ast, {
      enter(path) {
        const node = path.node;
        if (
          !node.loc ||
          selectedPosition < node.start ||
          selectedPosition > node.end
        ) {
          return;
        }

        console.log(`[节点] 处理 ${node.type} 节点`);

        // 检查是否是变量声明
        if (
          babelTypes.isVariableDeclarator(node) &&
          babelTypes.isIdentifier(node.id) &&
          node.id.name === variableName
        ) {
          const insertPosition = document.positionAt(node.end);
          validPosition = {
            line: insertPosition.line,
            character: insertPosition.character,
            isEndOfStatement: true,
            scopeStart: path.scope?.block?.start,
            scopeEnd: path.scope?.block?.end,
          };
          console.log(
            `[变量声明] 找到插入位置: ${insertPosition.line}:${insertPosition.character}`
          );
        }

        // 处理函数内的变量
        if (
          (babelTypes.isArrowFunctionExpression(node) ||
            babelTypes.isFunctionExpression(node)) &&
          node.body &&
          babelTypes.isBlockStatement(node.body)
        ) {
          console.log(`[函数] 检查函数体中的变量`);
          for (const stmt of node.body.body) {
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
                    scopeStart: node.body.start,
                    scopeEnd: node.body.end,
                  };
                  console.log(
                    `[函数变量] 找到插入位置: ${insertPosition.line}:${insertPosition.character}`
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
      console.log(
        `[最后语句] 使用最后语句位置: ${insertPosition.line}:${insertPosition.character}`
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
      console.log(
        `[行末] 使用行末位置: ${selection.end.line}:${line.text.length}`
      );
    }

    return validPosition;
  } catch (e) {
    console.error(`[异常] 处理 ${variableName} 时出错:`, e);
    console.error(
      `[异常] 位置: 行 ${selection.start.line}, 列 ${selection.start.character}`
    );
    console.error(`[异常堆栈] ${e.stack}`);

    // 出错时回退到行末
    const line = document.lineAt(selection.end.line);
    return {
      line: selection.end.line,
      character: line.text.length,
      isEndOfStatement: false,
    };
  }
}

// 新增：获取变量定义信息
export function getVariableDefinition(
  document: vscode.TextDocument,
  position: vscode.Position,
  variableName: string
): VariableInfo | null {
  const code = document.getText();
  const offset = document.offsetAt(position);

  try {
    const ast = parseCode(code, document.fileName);
    const globalScope = buildScopeTree(ast);

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
      return null;
    }

    // 在当前作用域及其父作用域中查找变量
    let scope: ScopeInfo | null = currentScope;
    while (scope) {
      const variable = scope.variables.find((v) => v.name === variableName);
      if (variable) {
        return variable;
      }
      scope = scope.parent;
    }

    return null;
  } catch (e) {
    console.error("getVariableDefinition->解析错误:", e);
    return null;
  }
}



// 添加到文件底部
export function debugCodeAnalysis(
  document: vscode.TextDocument,
  position: vscode.Position,
  variableName: string
): void {
  console.log("=================== 代码分析调试开始 ===================");
  console.log(`文件: ${document.fileName}`);
  console.log(`位置: 行 ${position.line}, 列 ${position.character}`);
  console.log(`变量名: ${variableName}`);

  try {
    const code = document.getText();
    const offset = document.offsetAt(position);
    const ast = parseCode(code, document.fileName);
    const globalScope = buildScopeTree(ast);

    console.log("作用域树构建完成:");
    console.log(`全局作用域包含 ${globalScope.variables.length} 个变量`);

    const contextInfo = getEnclosingContextName(document, position);
    console.log(
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
    console.log(
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
    console.log(
      "插入点:",
      insertPoint
        ? `行 ${insertPoint.line}, 列 ${insertPoint.character}`
        : "未找到合适插入点"
    );

    console.log("=================== 代码分析调试结束 ===================");
  } catch (error) {
    console.error("调试过程出错:", error);
  }
}
// 添加到文件底部

// 专门用于调试对象方法的函数
export function debugObjectMethodAnalysis(
  document: vscode.TextDocument,
  position: vscode.Position,
  variableName: string
): void {
  console.log("=================== 对象方法分析开始 ===================");

  try {
    const code = document.getText();
    const offset = document.offsetAt(position);
    const ast = parseCode(code, document.fileName);

    // 单独分析对象方法
    traverse(ast, {
      ObjectMethod(path) {
        const node = path.node;
        if (!node.loc) return;

        // 检查位置是否在当前对象方法内
        if (offset >= node.start && offset <= node.end) {
          console.log(`[找到] 对象方法: ${node.key?.name || "匿名"}`);

          // 获取对象名信息
          let objPath = path.parentPath;
          while (objPath && !babelTypes.isObjectExpression(objPath.node)) {
            objPath = objPath.parentPath;
          }

          if (objPath && objPath.parent) {
            if (
              babelTypes.isVariableDeclarator(objPath.parent) &&
              babelTypes.isIdentifier(objPath.parent.id)
            ) {
              console.log(`[找到] 对象名: ${objPath.parent.id.name}`);
            }
          }

          // 检查方法内变量
          if (babelTypes.isBlockStatement(node.body)) {
            console.log(
              `[分析] 方法体范围: ${node.body.start}-${node.body.end}`
            );

            for (const stmt of node.body.body) {
              if (babelTypes.isVariableDeclaration(stmt)) {
                for (const decl of stmt.declarations) {
                  if (babelTypes.isIdentifier(decl.id)) {
                    console.log(
                      `[发现] 变量: ${decl.id.name} 位置:${decl.id.start}-${decl.id.end}`
                    );

                    if (decl.id.name === variableName) {
                      console.log(`[匹配] 找到目标变量: ${variableName}`);
                    }
                  }
                }
              }
            }
          }

          // 构建一次路径来测试
          const path = buildPathHierarchy(path);
          console.log(`[路径测试] 构建路径结果: ${path.join(".")}`);
        }
      },
    });

    console.log("=================== 对象方法分析结束 ===================");
  } catch (error) {
    console.error("对象方法分析出错:", error);
  }
}
