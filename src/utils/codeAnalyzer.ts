// 导入VSCode API模块，用于与VSCode编辑器交互
import * as vscode from "vscode";
// 导入Babel解析器模块，用于将代码解析为抽象语法树(AST)
import * as parser from "@babel/parser";
// 导入Babel遍历器模块，用于遍历AST，NodePath是遍历时的节点路径类型
import traverse, { NodePath } from "@babel/traverse";
// 导入Babel类型模块，提供AST节点的类型判断方法
import * as babelTypes from "@babel/types";

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
}
