import * as vscode from "vscode"; // 导入VSCode API
import * as parser from "@babel/parser"; // 导入Babel解析器
import traverse, { NodePath } from "@babel/traverse"; // 导入Babel遍历器
import * as babelTypes from "@babel/types"; // 导入Babel类型定义

// 定义插入位置的接口
interface InsertionPosition {
	line: number; // 行号
	character: number; // 字符位置
	isEndOfStatement: boolean; // 是否是语句的末尾
}

// 返回上下文信息的接口
export interface ContextInfo {
	functionName: string | null;
	objectName: string | null;
}

// 获取包含选中位置的函数名和对象名
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
				)
					return;

				if (offset >= node.start && offset <= node.end) {
					// 检查函数声明
					if (babelTypes.isFunctionDeclaration(node) && node.id) {
						functionName = node.id.name;
					}
					// 检查函数表达式
					else if (
						babelTypes.isFunctionExpression(node) &&
						path.parent &&
						babelTypes.isVariableDeclarator(path.parent) &&
						path.parent.id &&
						babelTypes.isIdentifier(path.parent.id)
					) {
						functionName = path.parent.id.name;
					}
					// 检查箭头函数
					else if (
						babelTypes.isArrowFunctionExpression(node) &&
						path.parent &&
						babelTypes.isVariableDeclarator(path.parent) &&
						path.parent.id &&
						babelTypes.isIdentifier(path.parent.id)
					) {
						functionName = path.parent.id.name;
					}
					// 检查对象方法
					else if (
						babelTypes.isObjectMethod(node) &&
						node.key &&
						babelTypes.isIdentifier(node.key)
					) {
						functionName = node.key.name;

						// 寻找对象名称
						let parent = path.parentPath;
						while (parent && !babelTypes.isObjectExpression(parent.node)) {
							parent = parent.parentPath;
						}

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
					// 检查类方法
					else if (
						babelTypes.isClassMethod(node) &&
						node.key &&
						babelTypes.isIdentifier(node.key)
					) {
						functionName = node.key.name;

						// 寻找类名
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
				}
			},
		});

		return { functionName, objectName };
	} catch (e) {
		console.error("解析错误:", e);
		return { functionName: null, objectName: null };
	}
}

// 导出查找有效插入点的函数
export function findValidInsertionPoint(
	document: vscode.TextDocument,
	selection: vscode.Selection,
	variableName: string
): InsertionPosition | null {
	const code = document.getText();

	// 使用Babel解析器解析代码
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
	// 跟踪方法体内的语句
	let methodBodyStatements: any[] = [];
	let inMethodBody = false;
	let currentMethodBodyNode: any = null;

	traverse(ast, {
		enter(path) {
			const node = path.node;

			if (!node.loc) return;

			// 检查是否在方法体内
			if (
				(babelTypes.isObjectMethod(path.parent) ||
					babelTypes.isClassMethod(path.parent)) &&
				babelTypes.isBlockStatement(node)
			) {
				inMethodBody = true;
				currentMethodBodyNode = node;
				methodBodyStatements = [];
			}

			// 检查选中位置是否在该节点内
			if (
				typeof node.start === "number" &&
				typeof node.end === "number" &&
				selectedPosition >= node.start &&
				selectedPosition <= node.end
			) {
				enclosingNode = node;

				// 如果找到包含变量的变量声明或表达式语句，更新最后语句的结束位置
				if (
					(babelTypes.isVariableDeclaration(node) ||
						babelTypes.isExpressionStatement(node)) &&
					node.end > lastStatementEnd
				) {
					lastStatementEnd = node.end;

					// 如果在方法体内，记录该语句
					if (inMethodBody && currentMethodBodyNode) {
						methodBodyStatements.push(node);
					}
				}
			}
		},
		exit(path) {
			const node = path.node;

			// 如果退出方法体，重置方法体相关标志
			if (
				(babelTypes.isObjectMethod(path.parent) ||
					babelTypes.isClassMethod(path.parent)) &&
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
				// 找到包含选中变量的语句在方法体内
				const containingStatement = methodBodyStatements.find(
					(stmt) =>
						stmt.start <= enclosingNode.start && stmt.end >= enclosingNode.end
				);

				if (containingStatement) {
					const insertPosition = document.positionAt(containingStatement.end);
					validPosition = {
						line: insertPosition.line,
						character: insertPosition.character,
						isEndOfStatement: true,
					};
					return;
				}
			}

			// 原有的块级语句处理
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
				// 检查该块是否是对象方法的方法体
				const isMethodBody =
					babelTypes.isBlockStatement(node) &&
					(babelTypes.isObjectMethod(path.parent) ||
						babelTypes.isClassMethod(path.parent));

				// 如果是方法体，使用方法体内部的插入点
				if (!validPosition) {
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

			// 特殊处理对象属性
			if (
				babelTypes.isObjectProperty(node) &&
				typeof node.start === "number" &&
				typeof node.end === "number" &&
				node.start <= selectedPosition &&
				node.end >= selectedPosition
			) {
				// 找到父对象表达式
				let currentPath = path;
				while (
					currentPath &&
					!babelTypes.isObjectExpression(currentPath.node)
				) {
					const parent = currentPath.parentPath;
					if (!parent) break;
					currentPath = parent;
				}

				if (
					currentPath &&
					babelTypes.isObjectExpression(currentPath.node) &&
					typeof currentPath.node.end === "number"
				) {
					const objEnd = document.positionAt(currentPath.node.end);

					let statementPath = currentPath;
					while (
						statementPath &&
						statementPath.parentPath &&
						!babelTypes.isVariableDeclaration(statementPath.node) &&
						!babelTypes.isExpressionStatement(statementPath.node)
					) {
						statementPath = statementPath.parentPath;
					}

					if (statementPath && typeof statementPath.node.end === "number") {
						const stmtEnd = document.positionAt(statementPath.node.end);
						validPosition = {
							line: stmtEnd.line,
							character: stmtEnd.character,
							isEndOfStatement: true,
						};
					}
				}
			}

			// 特殊处理对象方法
			if (
				babelTypes.isObjectMethod(node) &&
				enclosingNode &&
				typeof node.body === "object" &&
				node.body &&
				typeof node.body.start === "number" &&
				typeof node.body.end === "number" &&
				node.body.start <= selectedPosition &&
				node.body.end >= selectedPosition
			) {
				// 在对象方法体内，找到包含选中变量的语句
				const methodStatements = (node.body as any).body || [];
				for (const stmt of methodStatements) {
					if (
						typeof stmt.start === "number" &&
						typeof stmt.end === "number" &&
						stmt.start <= selectedPosition &&
						stmt.end >= selectedPosition
					) {
						// 在该语句后插入
						const insertPosition = document.positionAt(stmt.end);
						validPosition = {
							line: insertPosition.line,
							character: insertPosition.character,
							isEndOfStatement: true,
						};
						break;
					}
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
