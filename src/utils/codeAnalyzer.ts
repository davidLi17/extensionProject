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
export interface ContextInfo {
	functionName: string | null; // 函数名
	ObjectName: string | null; // 对象名
}
export function getEnclosingContextName(
	document: vscode.TextDocument,
	position: vscode.Position
): ContextInfo {
	const code = document.getText(); // 获取文档的文本内容,example: "const a = 1;"
	const offset = document.offsetAt(position); // 获取光标在文档中的偏移量,example: 5

	let functionName: string | null = null;
	let ObjectName: string | null = null;

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
					if (babelTypes.isFunctionDeclaration(node) && node.id) {
						//检查函数声明
						functionName = node.id.name;
					} else if (
						babelTypes.isFunctionExpression(node) &&
						path.parent &&
						babelTypes.isVariableDeclarator(path.parent) &&
						path.parent.id &&
						babelTypes.isIdentifier(path.parent.id)
					) {
						functionName = path.parent.id.name; //检查函数表达式
					}else if {
						
					}
				}
			},
		});
	} catch (error) {}
}
// 导出查找有效插入点的函数
export function findValidInsertionPoint(
	document: vscode.TextDocument, // VSCode文本文档对象
	selection: vscode.Selection, // 用户选中的区域
	variableName: string // 变量名
): InsertionPosition | null {
	const code = document.getText();

	// 使用Babel解析器解析代码
	let ast;
	try {
		// 根据文件扩展名确定源代码类型
		const sourceType: "module" | "script" | "unambiguous" =
			document.fileName.endsWith(".tsx") || document.fileName.endsWith(".jsx")
				? "script"
				: "module";

		// 解析代码，生成AST
		ast = parser.parse(code, {
			sourceType: sourceType, // 源代码类型
			plugins: ["typescript", "jsx", "decorators-legacy", "classProperties"], // 启用的插件
		});
	} catch (e) {
		// 如果解析出错，打印错误并返回null
		console.error("解析错误:", e);
		return null;
	}

	// 获取选中变量的位置
	const selectedPosition = document.offsetAt(selection.start);

	// 初始化有效位置和包含节点
	let validPosition: InsertionPosition | null = null;
	let enclosingNode: any = null;
	let lastStatementEnd = 0;

	// 遍历AST，查找包含选中变量的节点，并确定有效插入点
	traverse(ast, {
		enter(path) {
			const node = path.node;

			// 如果节点没有位置信息，直接返回
			if (!node.loc) return;

			// 获取节点的起始和结束位置
			const nodeStart = document.positionAt(node.start as number);
			const nodeEnd = document.positionAt(node.end as number);

			// 检查选中位置是否在该节点内
			if (
				typeof node.start === "number" &&
				typeof node.end === "number" &&
				selectedPosition >= node.start &&
				selectedPosition <= node.end
			) {
				// 存储包含节点
				enclosingNode = node;

				// 如果找到包含变量的变量声明或表达式语句，更新最后语句的结束位置
				if (
					(babelTypes.isVariableDeclaration(node) ||
						babelTypes.isExpressionStatement(node)) &&
					node.end > lastStatementEnd
				) {
					lastStatementEnd = node.end;
				}
			}
		},
		exit(path) {
			// 当退出包含选中变量的语句或块时，记录潜在的插入点
			const node = path.node;

			// 当退出包含选中变量的块语句、变量声明或表达式时
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
				// 如果退出的是包含选中变量的块，可以在包含选中变量的语句后插入
				const insertPosition = document.positionAt(
					lastStatementEnd > 0 ? lastStatementEnd : enclosingNode.end
				);
				validPosition = {
					line: insertPosition.line,
					character: insertPosition.character,
					isEndOfStatement: true,
				};
			}

			// 特殊处理对象属性，避免在对象字面量中间插入
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
					// 获取对象表达式的结束位置
					const objEnd = document.positionAt(currentPath.node.end);

					// 找到包含的语句
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
