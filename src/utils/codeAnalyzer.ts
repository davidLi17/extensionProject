import * as vscode from "vscode";
import * as parser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import * as babelTypes from "@babel/types";

<<<<<<< HEAD
// 定义插入位置的数据结构接口
interface InsertionPosition {
	line: number; // 插入位置的行号
	character: number; // 插入位置的字符偏移量
	isEndOfStatement: boolean; // 标识是否在语句末尾插入
}

// 定义上下文信息的返回接口
export interface ContextInfo {
	functionName: string | null; // 函数名称，可能为null
	objectName: string | null; // 对象名称，可能为null
}

// 获取包含指定位置的函数名和对象名
export function getEnclosingContextName(
	document: vscode.TextDocument,
	position: vscode.Position
): ContextInfo {
	const code = document.getText();
	const offset = document.offsetAt(position);

	let functionName: string | null = null;
	let objectName: string | null = null;

	try {
		const sourceType: "module" | "script" | "unambiguous" =
			document.fileName.endsWith(".tsx") || document.fileName.endsWith(".jsx")
				? "script"
				: "module";

		const ast = parser.parse(code, {
			sourceType: sourceType,
			plugins: ["typescript", "jsx", "decorators-legacy", "classProperties"],
		});

		traverse(ast, {
			enter(path) {
				const node = path.node;

				if (
					!node.loc ||
					typeof node.start !== "number" ||
					typeof node.end !== "number"
				) {
					return;
				}

				if (offset >= node.start && offset <= node.end) {
					// 处理函数声明
					if (babelTypes.isFunctionDeclaration(node) && node.id) {
						functionName = node.id.name;
					}
					// 处理函数表达式
					else if (babelTypes.isFunctionExpression(node)) {
						// 1. 如果函数表达式有名称，直接使用
						if (node.id && node.id.name) {
							functionName = node.id.name;
						}
						// 2. 处理变量声明中的函数表达式
						else if (
							path.parent &&
							babelTypes.isVariableDeclarator(path.parent) &&
							path.parent.id &&
							babelTypes.isIdentifier(path.parent.id)
						) {
							functionName = path.parent.id.name;
						}
						// 3. 处理对象属性中的函数表达式
						else if (
							path.parent &&
							babelTypes.isObjectProperty(path.parent) &&
							path.parent.key &&
							babelTypes.isIdentifier(path.parent.key)
						) {
							functionName = path.parent.key.name;

							// 获取对象名称
							let objectPath = path.parentPath?.parentPath;
							if (
								objectPath &&
								babelTypes.isObjectExpression(objectPath.node) &&
								objectPath.parentPath &&
								babelTypes.isVariableDeclarator(objectPath.parentPath.node) &&
								objectPath.parentPath.node.id &&
								babelTypes.isIdentifier(objectPath.parentPath.node.id)
							) {
								objectName = objectPath.parentPath.node.id.name;
							}
						}
						// 4. 处理赋值表达式中的函数表达式
						else if (
							path.parent &&
							babelTypes.isAssignmentExpression(path.parent) &&
							path.parent.left
						) {
							if (babelTypes.isIdentifier(path.parent.left)) {
								functionName = path.parent.left.name;
							} else if (babelTypes.isMemberExpression(path.parent.left)) {
								if (babelTypes.isIdentifier(path.parent.left.property)) {
									functionName = path.parent.left.property.name;

									// 尝试获取对象名
									if (babelTypes.isIdentifier(path.parent.left.object)) {
										objectName = path.parent.left.object.name;
									}
								}
							}
						}
						// 5. 处理函数调用中的匿名函数（回调函数）
						else if (path.parent && babelTypes.isCallExpression(path.parent)) {
							const callExpr = path.parent;
							if (babelTypes.isIdentifier(callExpr.callee)) {
								const fnName = callExpr.callee.name;
								const argIndex = callExpr.arguments.indexOf(node);
								functionName = `${fnName}_callback${
									argIndex !== -1 ? argIndex : ""
								}`;
							} else if (babelTypes.isMemberExpression(callExpr.callee)) {
								if (babelTypes.isIdentifier(callExpr.callee.property)) {
									const methodName = callExpr.callee.property.name;
									const argIndex = callExpr.arguments.indexOf(node);
									functionName = `${methodName}_callback${
										argIndex !== -1 ? argIndex : ""
									}`;

									if (babelTypes.isIdentifier(callExpr.callee.object)) {
										objectName = callExpr.callee.object.name;
									}
								}
							}
						}
						// 6. 处理立即执行函数表达式(IIFE)
						else if (
							path.parent &&
							babelTypes.isCallExpression(path.parent) &&
							path.parent.callee === node
						) {
							functionName = "IIFE";
						}
						// 7. 如果以上都不匹配，标记为匿名函数
						else {
							functionName = "anonymous";

							// 尝试从上下文推断函数名
							let parentPath = path.parentPath;
							let depth = 0;
							const maxDepth = 3; // 限制向上查找的层级

							while (parentPath && depth < maxDepth) {
								// 检查是否在类方法内
								const classMethod = parentPath.findParent(
									(p) =>
										babelTypes.isClassMethod(p.node) &&
										p.node.key &&
										babelTypes.isIdentifier(p.node.key)
								);

								if (
									classMethod &&
									babelTypes.isIdentifier(classMethod.node.key)
								) {
									functionName = `${classMethod.node.key.name}_inner`;

									// 尝试获取类名
									const classDecl = classMethod.findParent(
										(p) =>
											!!(babelTypes.isClassDeclaration(p.node) && p.node.id)
									);

									if (classDecl && babelTypes.isIdentifier(classDecl.node.id)) {
										objectName = classDecl.node.id.name;
									}

									break;
								}

								// 检查是否在函数内
								const parentFunction = parentPath.findParent(
									(p) =>
										(babelTypes.isFunctionDeclaration(p.node) ||
											babelTypes.isFunctionExpression(p.node) ||
											babelTypes.isArrowFunctionExpression(p.node)) &&
										p.node !== node
								);

								if (parentFunction) {
									let parentFunctionName = null;

									// 获取父函数名
									if (
										babelTypes.isFunctionDeclaration(parentFunction.node) &&
										parentFunction.node.id
									) {
										parentFunctionName = parentFunction.node.id.name;
									} else if (
										parentFunction.parent &&
										babelTypes.isVariableDeclarator(parentFunction.parent) &&
										parentFunction.parent.id &&
										babelTypes.isIdentifier(parentFunction.parent.id)
									) {
										parentFunctionName = parentFunction.parent.id.name;
									}

									if (parentFunctionName) {
										functionName = `${parentFunctionName}_inner`;
										break;
									}
								}

								parentPath = parentPath.parentPath;
								depth++;
							}
						}
					}
					// 处理箭头函数 (其他箭头函数处理逻辑保持不变)
					else if (babelTypes.isArrowFunctionExpression(node) && path.parent) {
						// 1. 箭头函数作为变量声明
						if (
							babelTypes.isVariableDeclarator(path.parent) &&
							path.parent.id &&
							babelTypes.isIdentifier(path.parent.id)
						) {
							functionName = path.parent.id.name;
						}
						// 2. 箭头函数作为对象属性
						else if (
							babelTypes.isObjectProperty(path.parent) &&
							path.parent.key &&
							babelTypes.isIdentifier(path.parent.key)
						) {
							functionName = path.parent.key.name;

							// 查找所属对象名
							let objectPath = path.parentPath?.parentPath;
							if (
								objectPath &&
								babelTypes.isObjectExpression(objectPath.node) &&
								objectPath.parentPath &&
								babelTypes.isVariableDeclarator(objectPath.parentPath.node) &&
								objectPath.parentPath.node.id &&
								babelTypes.isIdentifier(objectPath.parentPath.node.id)
							) {
								objectName = objectPath.parentPath.node.id.name;
							}
						}
						// 3. 箭头函数作为类属性
						else if (
							babelTypes.isClassProperty(path.parent) &&
							path.parent.key &&
							babelTypes.isIdentifier(path.parent.key)
						) {
							functionName = path.parent.key.name;

							// 查找所属类名
							const classPath = path.findParent((p) =>
								babelTypes.isClassDeclaration(p.node)
							);

							if (
								classPath &&
								babelTypes.isClassDeclaration(classPath.node) &&
								classPath.node.id
							) {
								objectName = classPath.node.id.name;
							}
						}
						// 4. 箭头函数作为赋值表达式
						else if (
							babelTypes.isAssignmentExpression(path.parent) &&
							babelTypes.isIdentifier(path.parent.left)
						) {
							functionName = path.parent.left.name;

							// 检查是否是对象成员赋值 obj.method = () => {}
							if (babelTypes.isMemberExpression(path.parent.left)) {
								if (babelTypes.isIdentifier(path.parent.left.object)) {
									objectName = path.parent.left.object.name;
								}
								if (babelTypes.isIdentifier(path.parent.left.property)) {
									functionName = path.parent.left.property.name;
								}
							}
						}
						// 5. 作为函数调用的参数，尝试从注释或上下文推断名称
						else if (babelTypes.isCallExpression(path.parent)) {
							// 尝试从父函数名和参数位置推断名称
							const calleeNode = path.parent.callee;
							if (babelTypes.isIdentifier(calleeNode)) {
								const fnName = calleeNode.name;
								const argIndex = path.parent.arguments.indexOf(node);
								functionName = `${fnName}_callback${
									argIndex !== -1 ? argIndex : ""
								}`;
							}
						}
					}
					// 处理对象方法
					else if (
						babelTypes.isObjectMethod(node) &&
						node.key &&
						babelTypes.isIdentifier(node.key)
					) {
						functionName = node.key.name;

						// 向上查找对象表达式
						let parent = path.parentPath;
						while (parent && !babelTypes.isObjectExpression(parent.node)) {
							parent = parent.parentPath;
						}

						// 如果找到对象表达式且其父节点是变量声明
						if (
							parent &&
							parent.parent &&
							babelTypes.isVariableDeclarator(parent.parent) &&
							parent.parent.id &&
							babelTypes.isIdentifier(parent.parent.id)
						) {
							objectName = parent.parent.id.name;
						}
					}
					// 处理类方法
					else if (
						babelTypes.isClassMethod(node) &&
						node.key &&
						babelTypes.isIdentifier(node.key)
					) {
						functionName = node.key.name;

						// 向上查找类声明
						const classPath = path.findParent((p) =>
							babelTypes.isClassDeclaration(p.node)
						);
						// 如果找到类声明且有类名
						if (
							classPath &&
							babelTypes.isClassDeclaration(classPath.node) &&
							classPath.node.id
						) {
							objectName = classPath.node.id.name;
						}
					}
				}
			},
		});

		return { functionName, objectName };
	} catch (e) {
		console.error("解析错误:", e);
		return { functionName: null, objectName: null };
	}
}

// 查找有效的代码插入点
export function findValidInsertionPoint(
	document: vscode.TextDocument,
	selection: vscode.Selection,
	variableName: string
): InsertionPosition | null {
	const code = document.getText();

	let ast;
	try {
		const sourceType: "module" | "script" | "unambiguous" =
			document.fileName.endsWith(".tsx") || document.fileName.endsWith(".jsx")
				? "script"
				: "module";

		ast = parser.parse(code, {
			sourceType: sourceType,
			plugins: ["typescript", "jsx", "decorators-legacy", "classProperties"],
		});
	} catch (e) {
		console.error("解析错误:", e);
		return null;
	}

	const selectedPosition = document.offsetAt(selection.start);

	let validPosition: InsertionPosition | null = null;
	let enclosingNode: any = null;
	let lastStatementEnd = 0;
	let methodBodyStatements: any[] = [];
	let inMethodBody = false;
	let currentMethodBodyNode: any = null;
	let inArrowFunction = false;
	let arrowFunctionNode: any = null;

	traverse(ast, {
		enter(path) {
			const node = path.node;

			if (!node.loc) {
				return;
			}

			// 检查是否进入箭头函数体
			if (
				babelTypes.isArrowFunctionExpression(path.parent) &&
				(babelTypes.isBlockStatement(node) || node === path.parent.body)
			) {
				inArrowFunction = true;
				arrowFunctionNode = path.parent;
				if (babelTypes.isBlockStatement(node)) {
					inMethodBody = true;
					currentMethodBodyNode = node;
					methodBodyStatements = [];
				}
			}

			// 检查是否进入方法体
			if (
				(babelTypes.isObjectMethod(path.parent) ||
					babelTypes.isClassMethod(path.parent) ||
					babelTypes.isFunctionDeclaration(path.parent) ||
					babelTypes.isFunctionExpression(path.parent)) &&
				babelTypes.isBlockStatement(node)
			) {
				inMethodBody = true;
				currentMethodBodyNode = node;
				methodBodyStatements = [];
			}

			// 检查当前节点是否包含选中位置
			if (
				typeof node.start === "number" &&
				typeof node.end === "number" &&
				selectedPosition >= node.start &&
				selectedPosition <= node.end
			) {
				enclosingNode = node;

				// 如果是变量声明或表达式语句，更新最后语句结束位置
				if (
					(babelTypes.isVariableDeclaration(node) ||
						babelTypes.isExpressionStatement(node)) &&
					node.end > lastStatementEnd
				) {
					lastStatementEnd = node.end;

					// 如果在方法体内，记录该语句
					if ((inMethodBody && currentMethodBodyNode) || inArrowFunction) {
						methodBodyStatements.push(node);
					}
				}
			}
		},
		exit(path) {
			const node = path.node;

			// 如果退出箭头函数体
			if (
				babelTypes.isArrowFunctionExpression(path.parent) &&
				(babelTypes.isBlockStatement(node) || node === path.parent.body)
			) {
				inArrowFunction = false;
				arrowFunctionNode = null;
				if (babelTypes.isBlockStatement(node)) {
					inMethodBody = false;
					currentMethodBodyNode = null;
				}
			}

			// 如果退出方法体，重置相关标志
			if (
				(babelTypes.isObjectMethod(path.parent) ||
					babelTypes.isClassMethod(path.parent) ||
					babelTypes.isFunctionDeclaration(path.parent) ||
					babelTypes.isFunctionExpression(path.parent)) &&
				babelTypes.isBlockStatement(node)
			) {
				inMethodBody = false;
				currentMethodBodyNode = null;
			}

			// 处理方法体内的语句
			if (
				enclosingNode &&
				methodBodyStatements.length > 0 &&
				methodBodyStatements.some(
					(stmt) =>
						stmt.start <= enclosingNode.start && stmt.end >= enclosingNode.end
				)
			) {
				// 找到包含选中变量的语句
				const containingStatement = methodBodyStatements.find(
					(stmt) =>
						stmt.start <= enclosingNode.start && stmt.end >= enclosingNode.end
				);

				if (containingStatement) {
					// 在该语句后插入
					const insertPosition = document.positionAt(containingStatement.end);
					validPosition = {
						line: insertPosition.line,
						character: insertPosition.character,
						isEndOfStatement: true,
					};
					return;
				}
			}

			// 处理箭头函数没有块的情况（隐式返回）
			if (
				babelTypes.isArrowFunctionExpression(node) &&
				!babelTypes.isBlockStatement(node.body) &&
				enclosingNode &&
				typeof node.body.start === "number" &&
				typeof node.body.end === "number" &&
				node.body.start <= selectedPosition &&
				node.body.end >= selectedPosition
			) {
				// 在箭头函数前插入日志，添加大括号转换为块语句
				const insertPosition = document.positionAt(
					typeof node.start === "number" ? node.start : 0
				);
				validPosition = {
					line: insertPosition.line,
					character: insertPosition.character,
					isEndOfStatement: false,
				};
				return;
			}

			// 处理块级语句
			if (
				(babelTypes.isBlockStatement(node) ||
					babelTypes.isVariableDeclaration(node) ||
					babelTypes.isExpressionStatement(node)) &&
				enclosingNode &&
				typeof node.start === "number" &&
				typeof enclosingNode.start === "number" &&
				typeof node.end === "number" &&
				node.start <= enclosingNode.start &&
				node.end >= enclosingNode.end
			) {
				// 检查是否是方法体或箭头函数体
				const isMethodBody =
					babelTypes.isBlockStatement(node) &&
					(babelTypes.isObjectMethod(path.parent) ||
						babelTypes.isClassMethod(path.parent) ||
						babelTypes.isFunctionDeclaration(path.parent) ||
						babelTypes.isFunctionExpression(path.parent) ||
						babelTypes.isArrowFunctionExpression(path.parent));

				// 如果还没有找到有效位置
				if (!validPosition) {
					// 确定插入位置
					const insertPosition = document.positionAt(
						lastStatementEnd > 0 ? lastStatementEnd : enclosingNode.end
					);
					validPosition = {
						line: insertPosition.line,
						character: insertPosition.character,
						isEndOfStatement: true,
					};
				}
			}
		},
	});

	// 如果没有找到合适的位置，回退到行末
	if (!validPosition) {
		const line = document.lineAt(selection.end.line);
		validPosition = {
			line: selection.end.line,
			character: line.text.length,
			isEndOfStatement: false,
		};
	}

	return validPosition;
=======
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
        Logger.trace(`处理对象方法: ${node.key?.name || "匿名"}`);
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

// 优化后的buildPathHierarchy，减少不必要的日志和计算
function buildPathHierarchy(path: NodePath): string[] {
  const result: string[] = [];
  Logger.trace(`开始构建路径层次，节点类型: ${path.node.type}`);

  let current: NodePath | null = path;
  const visitedPaths = new Set<NodePath>(); // 避免循环引用

  while (current && !visitedPaths.has(current)) {
    visitedPaths.add(current);

    // 处理对象方法
    if (
      babelTypes.isObjectMethod(current.node) &&
      babelTypes.isIdentifier(current.node.key)
    ) {
      result.unshift(current.node.key.name);
      Logger.trace(`添加对象方法名: ${current.node.key.name}`);

      // 查找对象表达式
      let objPath = current.parentPath;
      while (
        objPath &&
        !babelTypes.isObjectExpression(objPath.node) &&
        !visitedPaths.has(objPath)
      ) {
        visitedPaths.add(objPath);
        objPath = objPath.parentPath;
      }

      // 处理对象名称
      if (objPath && objPath.parent) {
        if (
          babelTypes.isVariableDeclarator(objPath.parent) &&
          babelTypes.isIdentifier(objPath.parent.id)
        ) {
          result.unshift(objPath.parent.id.name);
          Logger.trace(`添加变量声明对象名: ${objPath.parent.id.name}`);
        } else if (
          babelTypes.isObjectProperty(objPath.parent) &&
          babelTypes.isIdentifier(objPath.parent.key)
        ) {
          result.unshift(objPath.parent.key.name);
          Logger.trace(`添加对象属性名: ${objPath.parent.key.name}`);

          // 处理嵌套对象，限制处理深度以防止无限循环
          let parentObjPath = objPath.parentPath;
          let depth = 0;
          while (parentObjPath && depth < 10) {
            if (visitedPaths.has(parentObjPath)) break;
            visitedPaths.add(parentObjPath);
            depth++;

            if (
              babelTypes.isObjectProperty(parentObjPath.node) &&
              babelTypes.isIdentifier(parentObjPath.node.key)
            ) {
              result.unshift(parentObjPath.node.key.name);
              Logger.trace(
                `添加嵌套对象属性名: ${parentObjPath.node.key.name}`
              );
            } else if (
              babelTypes.isVariableDeclarator(parentObjPath.node) &&
              babelTypes.isIdentifier(parentObjPath.node.id)
            ) {
              result.unshift(parentObjPath.node.id.name);
              Logger.trace(`添加顶层变量名: ${parentObjPath.node.id.name}`);
              break;
            }
            parentObjPath = parentObjPath.parentPath;
          }
        }
      } else {
        Logger.warn("无法找到对象方法的父对象");
      }
      break;
    }

    // 处理类方法
    else if (
      babelTypes.isClassMethod(current.node) &&
      babelTypes.isIdentifier(current.node.key)
    ) {
      result.unshift(current.node.key.name);
      Logger.trace(`添加类方法名: ${current.node.key.name}`);

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
        Logger.trace(`添加类名: ${classPath.node.id.name}`);
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

// 优化后的getEnclosingContextName函数
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

    // 查找包含当前位置的最内层作用域，使用递归优化
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

    // 优化：合并遍历，一次性收集所需信息
    const nodeTypesToCheck = new Set([
      "FunctionDeclaration",
      "FunctionExpression",
      "ArrowFunctionExpression",
      "ObjectMethod",
      "ClassMethod",
    ]);

    traverse(ast, {
      enter(path) {
        const node = path.node;

        // 跳过没有位置信息的节点或不相关节点
        if (
          !node.loc ||
          typeof node.start !== "number" ||
          typeof node.end !== "number" ||
          !nodeTypesToCheck.has(node.type) ||
          offset < node.start ||
          offset > node.end
        ) {
          return;
        }

        Logger.trace(`处理节点类型: ${node.type}`);

        // 处理函数声明
        if (babelTypes.isFunctionDeclaration(node) && node.id) {
          functionName = node.id.name;
          Logger.debug(`找到函数声明: ${functionName}`);
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
          Logger.debug(`找到函数表达式: ${functionName}`);
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
          Logger.debug(`找到箭头函数: ${functionName}`);
        }
        // 处理对象方法
        else if (
          babelTypes.isObjectMethod(node) &&
          node.key &&
          babelTypes.isIdentifier(node.key)
        ) {
          functionName = node.key.name;
          Logger.debug(`找到对象方法: ${functionName}`);

          try {
            // 构建完整的层级路径
            const hierarchyPath = buildPathHierarchy(path);
            // @ts-ignore
            path = hierarchyPath;

            if (hierarchyPath.length >= 2) {
              objectName = hierarchyPath[0]; // 第一个元素应该是对象名
              functionName = hierarchyPath[1]; // 第二个元素是方法名
              Logger.debug(`解析对象路径: ${objectName}.${functionName}`);
            }
          } catch (pathError) {
            Logger.error("构建路径层次结构时出错:", pathError);
          }
        }
        // 处理类方法
        else if (
          babelTypes.isClassMethod(node) &&
          node.key &&
          babelTypes.isIdentifier(node.key)
        ) {
          functionName = node.key.name;
          Logger.debug(`找到类方法: ${functionName}`);

          const classPath = path.findParent((p) =>
            babelTypes.isClassDeclaration(p.node)
          );
          if (
            classPath &&
            babelTypes.isClassDeclaration(classPath.node) &&
            classPath.node.id
          ) {
            objectName = classPath.node.id.name;
            Logger.debug(`找到类名: ${objectName}`);
          }
        }
      },
    });

    Logger.info(
      `返回上下文信息: ${objectName ? objectName + "." : ""}${functionName}`
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
          if (objectMethods.has(node)) return;
          objectMethods.set(node, true);

          if (
            !node.loc ||
            selectedPosition < node.start ||
            selectedPosition > node.end
          ) {
            return;
          }

          Logger.trace(`检查对象方法: ${node.key?.name || "匿名"}`);
          const body = node.body;
          if (babelTypes.isBlockStatement(body)) {
            for (const stmt of body.body) {
              if (babelTypes.isVariableDeclaration(stmt)) {
                for (const decl of stmt.declarations) {
                  if (
                    babelTypes.isIdentifier(decl.id) &&
                    decl.id.name === variableName
                  ) {
                    Logger.debug(`在对象方法内找到变量: ${variableName}`);
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
    ]);

    traverse(ast, {
      enter(path) {
        const node = path.node;

        // 快速过滤不相关节点
        if (
          !node.type ||
          !relevantNodeTypes.has(node.type) ||
          !node.loc ||
          selectedPosition < node.start ||
          selectedPosition > node.end
        ) {
          return;
        }

        Logger.trace(`处理 ${node.type} 节点`);

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
          Logger.debug(
            `找到变量声明插入位置: ${insertPosition.line}:${insertPosition.character}`
          );
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
  // 临时提高日志级别以显示完整调试信息
  const previousLogLevel = LogLevel.INFO; // 假设当前级别
  Logger.setLevel(LogLevel.DEBUG);

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
  } finally {
    // 恢复之前的日志级别
    Logger.setLevel(previousLogLevel);
  }
}

// 专门用于调试对象方法的函数
export function debugObjectMethodAnalysis(
  document: vscode.TextDocument,
  position: vscode.Position,
  variableName: string
): void {
  // 临时提高日志级别
  const previousLogLevel = LogLevel.INFO; // 假设当前级别
  Logger.setLevel(LogLevel.DEBUG);

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
        if (!node.loc || processedNodes.has(node)) return;
        processedNodes.add(node);

        // 检查位置是否在当前对象方法内
        if (offset >= node.start && offset <= node.end) {
          Logger.info(`[找到] 对象方法: ${node.key?.name || "匿名"}`);

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
          const path = buildPathHierarchy(path);
          Logger.info(`[路径测试] 构建路径结果: ${path.join(".")}`);
        }
      },
    });

    Logger.info("=================== 对象方法分析结束 ===================");
  } catch (error) {
    Logger.error("对象方法分析出错:", error);
  } finally {
    // 恢复之前的日志级别
    Logger.setLevel(previousLogLevel);
  }
}

// 添加导出函数，用于控制日志级别
export function setLogLevel(level: LogLevel) {
  Logger.setLevel(level);
  Logger.info(`日志级别已设置为: ${LogLevel[level]}`);
}

// 添加导出函数，用于清除缓存
export function clearAnalyzerCache(fileName?: string) {
  AstCache.clearCache(fileName);
>>>>>>> 2f33655ce14ce026961655369a97b342cdc706cb
}
