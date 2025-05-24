import * as vscode from "vscode";
import traverse, { NodePath } from "@babel/traverse";
import * as babelTypes from "@babel/types";
import { ScopeInfo, VariableInfo, InsertionPosition, LogLevel } from "./types";
import { Logger } from "./core/logger";
import { AstCache } from "./core/astCache";

// 优化后的findValidInsertionPoint函数 - 增强兜底逻辑
export function findValidInsertionPoint(
	document: vscode.TextDocument,
	selection: vscode.Selection,
	variableName: string
): InsertionPosition | null {
	Logger.debug(`findValidInsertionPoint 被调用，变量: ${variableName}`);
	const code = document.getText();
	const selectedPosition = document.offsetAt(selection.start);

	// 首选兜底位置：触发位置的下一行
	const createFallbackPosition = (): InsertionPosition => {
		try {
			const currentLine = selection.end.line;
			const nextLine = Math.min(currentLine + 1, document.lineCount - 1);

			// 如果是最后一行，尝试获取行末位置
			if (nextLine === currentLine) {
				const line = document.lineAt(currentLine);
				return {
					line: currentLine,
					character: line.text.length,
					isEndOfStatement: false,
				};
			}

			// 返回下一行的开头
			return {
				line: nextLine,
				character: 0,
				isEndOfStatement: false,
			};
		} catch (e) {
			Logger.warn("创建兜底位置失败，使用当前选中位置", e);
			return {
				line: selection.end.line,
				character: selection.end.character,
				isEndOfStatement: false,
			};
		}
	};

	try {
		// 使用缓存获取AST和作用域树
		const ast = AstCache.getAst(code, document.fileName);
		const globalScope = AstCache.getScopeTree(code, document.fileName);

		// 首先尝试快速查找变量声明位置
		const quickResult = findVariableDeclarationQuickly(
			document,
			ast,
			variableName,
			selectedPosition
		);
		if (quickResult) {
			Logger.debug(
				`快速查找成功: 行 ${quickResult.line}, 列 ${quickResult.character}`
			);
			return quickResult;
		}

		// 备选方案：使用作用域分析
		const scopeResult = findVariableInScope(
			document,
			globalScope,
			variableName,
			selectedPosition
		);
		if (scopeResult) {
			Logger.debug(
				`作用域查找成功: 行 ${scopeResult.line}, 列 ${scopeResult.character}`
			);
			return scopeResult;
		}

		// 最后方案：对象方法内查找
		const objectMethodResult = findVariableInObjectMethods(
			document,
			ast,
			variableName,
			selectedPosition
		);
		if (objectMethodResult) {
			Logger.debug(
				`对象方法查找成功: 行 ${objectMethodResult.line}, 列 ${objectMethodResult.character}`
			);
			return objectMethodResult;
		}

		Logger.warn(`未找到变量 ${variableName} 的声明位置，使用兜底策略`);
		return createFallbackPosition();
	} catch (e) {
		Logger.error(`处理 ${variableName} 时出错，使用兜底策略:`, e);
		return createFallbackPosition();
	}
}

// 快速查找变量声明位置
function findVariableDeclarationQuickly(
	document: vscode.TextDocument,
	ast: any,
	variableName: string,
	selectedPosition: number
): InsertionPosition | null {
	let result: InsertionPosition | null = null;

	try {
		traverse(ast, {
			VariableDeclarator(path) {
				const node = path.node;

				// 基本验证
				if (
					!babelTypes.isIdentifier(node.id) ||
					node.id.name !== variableName ||
					typeof node.end !== "number"
				) {
					return;
				}

				// 位置验证 - 变量声明应该在选中位置之前或包含选中位置
				if (
					node.start !== null &&
					node.start !== undefined &&
					selectedPosition < node.start
				) {
					return;
				}

				// 获取完整的变量声明语句
				const declarationPath = path.findParent((p) =>
					babelTypes.isVariableDeclaration(p.node)
				);
				const targetNode = declarationPath?.node || node;

				if (typeof targetNode.end === "number") {
					const insertPosition = document.positionAt(targetNode.end);
					result = {
						line: insertPosition.line,
						character: insertPosition.character,
						isEndOfStatement: true,
						scopeStart: path.scope?.block?.start ?? undefined,
						scopeEnd: path.scope?.block?.end ?? undefined,
					};

					// 找到第一个匹配的就返回
					path.stop();
				}
			},
		});
	} catch (e) {
		Logger.warn("快速查找变量声明时出错:", e);
	}

	return result;
}

// 在作用域中查找变量
function findVariableInScope(
	document: vscode.TextDocument,
	globalScope: ScopeInfo,
	variableName: string,
	selectedPosition: number
): InsertionPosition | null {
	try {
		// 查找包含选中位置的作用域
		const currentScope = findScopeContainingPosition(
			globalScope,
			selectedPosition
		);
		if (!currentScope) {
			return null;
		}

		// 在当前作用域及其父作用域中查找变量
		let scope: ScopeInfo | null = currentScope;
		while (scope) {
			if (scope.variableMap && scope.variableMap.has(variableName)) {
				const variable = scope.variableMap.get(variableName)!;
				const insertPosition = document.positionAt(variable.declarationEnd);

				return {
					line: insertPosition.line,
					character: insertPosition.character,
					isEndOfStatement: true,
					scopeStart: scope.start,
					scopeEnd: scope.end,
				};
			}
			scope = scope.parent;
		}
	} catch (e) {
		Logger.warn("作用域查找时出错:", e);
	}

	return null;
}

// 在对象方法中查找变量
function findVariableInObjectMethods(
	document: vscode.TextDocument,
	ast: any,
	variableName: string,
	selectedPosition: number
): InsertionPosition | null {
	let result: InsertionPosition | null = null;

	try {
		traverse(ast, {
			ObjectMethod(path) {
				const node = path.node;

				// 基本验证
				if (
					!node.start ||
					!node.end ||
					!node.loc ||
					selectedPosition < node.start ||
					selectedPosition > node.end ||
					!babelTypes.isBlockStatement(node.body)
				) {
					return;
				}

				// 在方法体中查找变量声明
				for (const stmt of node.body.body) {
					if (babelTypes.isVariableDeclaration(stmt)) {
						for (const decl of stmt.declarations) {
							if (
								babelTypes.isIdentifier(decl.id) &&
								decl.id.name === variableName &&
								typeof stmt.end === "number"
							) {
								const insertPosition = document.positionAt(stmt.end);
								result = {
									line: insertPosition.line,
									character: insertPosition.character,
									isEndOfStatement: true,
									scopeStart: node.body.start || 0,
									scopeEnd: node.body.end || 0,
								};

								// 找到就停止
								return;
							}
						}
					}
				}
			},
		});
	} catch (e) {
		Logger.warn("对象方法查找时出错:", e);
	}

	return result;
}

// 查找包含指定位置的作用域
function findScopeContainingPosition(
	scope: ScopeInfo,
	position: number
): ScopeInfo | null {
	if (position < scope.start || position > scope.end) {
		return null;
	}
	return scope;
}

// 优化后的getVariableDefinition函数 - 增强错误处理
export function getVariableDefinition(
	document: vscode.TextDocument,
	position: vscode.Position,
	variableName: string
): VariableInfo | null {
	Logger.debug(`getVariableDefinition 被调用，变量: ${variableName}`);
	const code = document.getText();
	const offset = document.offsetAt(position);

	// 输入验证
	if (!variableName || variableName.trim().length === 0) {
		Logger.warn("变量名为空，无法查找定义");
		return null;
	}

	if (offset < 0 || offset >= code.length) {
		Logger.warn(`位置超出文档范围: ${offset}`);
		return null;
	}

	try {
		// 使用缓存
		const ast = AstCache.getAst(code, document.fileName);
		if (!ast) {
			Logger.error("无法获取AST");
			return null;
		}

		const globalScope = AstCache.getScopeTree(code, document.fileName);
		if (!globalScope) {
			Logger.warn("无法获取作用域树，尝试直接AST分析");
			return findVariableDefinitionInAst(document, ast, variableName, offset);
		}

		// 查找包含位置的最内层作用域
		const currentScope = findScopeAtPosition(globalScope, offset);
		if (!currentScope) {
			Logger.debug("未找到包含当前位置的作用域，尝试直接AST分析");
			return findVariableDefinitionInAst(document, ast, variableName, offset);
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

		// 备选方案：直接在AST中查找
		Logger.debug("在作用域树中未找到变量，尝试直接AST分析");
		return findVariableDefinitionInAst(document, ast, variableName, offset);
	} catch (e) {
		Logger.error(`getVariableDefinition 解析错误:`, e);

		// 最后的兜底：尝试简单的文本匹配
		try {
			return findVariableByTextMatch(document, variableName, offset);
		} catch (fallbackError) {
			Logger.error("兜底策略也失败了:", fallbackError);
			return null;
		}
	}
}

// 直接在AST中查找变量定义
function findVariableDefinitionInAst(
	document: vscode.TextDocument,
	ast: any,
	variableName: string,
	position: number
): VariableInfo | null {
	let result: VariableInfo | null = null;
	let closestMatch: VariableInfo | null = null;
	let closestDistance = Infinity;

	try {
		traverse(ast, {
			VariableDeclarator(path) {
				const node = path.node;

				if (
					!babelTypes.isIdentifier(node.id) ||
					node.id.name !== variableName ||
					typeof node.start !== "number" ||
					typeof node.end !== "number"
				) {
					return;
				}

				const variableInfo: VariableInfo = {
					name: variableName,
					declarationStart: node.start,
					declarationEnd: node.end,
					references: [],
					isParameter: false,
				};

				// 如果变量声明在当前位置之前，这是最理想的情况
				if (node.start <= position) {
					if (!result || node.start > result.declarationStart) {
						result = variableInfo;
					}
				} else {
					// 否则记录最近的匹配作为备选
					const distance = node.start - position;
					if (distance < closestDistance) {
						closestDistance = distance;
						closestMatch = variableInfo;
					}
				}
			},

			// 也检查函数参数
			FunctionDeclaration(path) {
				checkFunctionParameters(path.node, variableName, position, (info) => {
					if (!result || info.declarationStart <= position) {
						result = info;
					}
				});
			},

			FunctionExpression(path) {
				checkFunctionParameters(path.node, variableName, position, (info) => {
					if (!result || info.declarationStart <= position) {
						result = info;
					}
				});
			},

			ArrowFunctionExpression(path) {
				checkFunctionParameters(path.node, variableName, position, (info) => {
					if (!result || info.declarationStart <= position) {
						result = info;
					}
				});
			},
		});
	} catch (e) {
		Logger.warn("AST遍历时出错:", e);
	}

	// 如果没有找到理想的结果，使用最近的匹配
	return result || closestMatch;
}

// 检查函数参数
function checkFunctionParameters(
	node: any,
	variableName: string,
	position: number,
	callback: (info: VariableInfo) => void
): void {
	if (!node.params || !Array.isArray(node.params)) {
		return;
	}

	for (const param of node.params) {
		if (
			babelTypes.isIdentifier(param) &&
			param.name === variableName &&
			typeof param.start === "number" &&
			typeof param.end === "number"
		) {
			callback({
				name: variableName,
				declarationStart: param.start,
				declarationEnd: param.end,
				references: [],
				isParameter: true,
			});
		}
	}
}

// 简单的文本匹配作为最后的兜底
function findVariableByTextMatch(
	document: vscode.TextDocument,
	variableName: string,
	position: number
): VariableInfo | null {
	const text = document.getText();
	const lines = text.split("\n");
	const currentPosition = document.positionAt(position);

	// 在当前行及之前的行中查找变量声明的模式
	const declarationPatterns = [
		new RegExp(`\\b(const|let|var)\\s+${variableName}\\b`, "g"),
		new RegExp(`\\bfunction\\s+${variableName}\\b`, "g"),
		new RegExp(`\\b${variableName}\\s*[:=]`, "g"), // 对象属性或箭头函数
	];

	let bestMatch: VariableInfo | null = null;
	let bestLine = -1;

	for (let lineIndex = 0; lineIndex <= currentPosition.line; lineIndex++) {
		const line = lines[lineIndex];

		for (const pattern of declarationPatterns) {
			pattern.lastIndex = 0; // 重置正则表达式
			const match = pattern.exec(line);

			if (match) {
				const charIndex = match.index;
				const lineStartOffset = document.offsetAt(
					new vscode.Position(lineIndex, 0)
				);
				const matchStart = lineStartOffset + charIndex;
				const matchEnd = lineStartOffset + charIndex + match[0].length;

				// 如果这个声明在当前位置之前或之后不远，记录它
				if (matchStart <= position || lineIndex > bestLine) {
					bestMatch = {
						name: variableName,
						declarationStart: matchStart,
						declarationEnd: matchEnd,
						references: [],
						isParameter: false,
					};
					bestLine = lineIndex;
				}
			}
		}
	}

	return bestMatch;
}

// 查找包含指定位置的作用域
function findScopeAtPosition(
	scope: ScopeInfo,
	position: number
): ScopeInfo | null {
	if (position < scope.start || position > scope.end) {
		return null;
	}
	return scope;
}

// 工具函数：验证插入位置的有效性
export function validateInsertionPosition(
	document: vscode.TextDocument,
	position: InsertionPosition
): InsertionPosition {
	try {
		// 确保行号在有效范围内
		const lineCount = document.lineCount;
		const validLine = Math.max(0, Math.min(position.line, lineCount - 1));

		// 确保字符位置在有效范围内
		const line = document.lineAt(validLine);
		const validCharacter = Math.max(
			0,
			Math.min(position.character, line.text.length)
		);

		return {
			...position,
			line: validLine,
			character: validCharacter,
		};
	} catch (e) {
		Logger.warn("验证插入位置时出错，使用文档开头:", e);
		return {
			line: 0,
			character: 0,
			isEndOfStatement: false,
		};
	}
}

// 工具函数：创建安全的兜底位置
export function createSafeInsertionPosition(
	document: vscode.TextDocument,
	selection: vscode.Selection,
	preferNextLine: boolean = true
): InsertionPosition {
	try {
		if (preferNextLine) {
			const currentLine = selection.end.line;
			const nextLine = Math.min(currentLine + 1, document.lineCount - 1);

			if (nextLine === currentLine) {
				// 如果是最后一行，插入到行末
				const line = document.lineAt(currentLine);
				return {
					line: currentLine,
					character: line.text.length,
					isEndOfStatement: false,
				};
			} else {
				// 插入到下一行的开头
				return {
					line: nextLine,
					character: 0,
					isEndOfStatement: false,
				};
			}
		} else {
			// 插入到当前选择位置的行末
			const line = document.lineAt(selection.end.line);
			return {
				line: selection.end.line,
				character: line.text.length,
				isEndOfStatement: false,
			};
		}
	} catch (e) {
		Logger.error("创建安全插入位置失败:", e);
		// 最后的兜底：文档开头
		return {
			line: 0,
			character: 0,
			isEndOfStatement: false,
		};
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

// 测试函数：验证兜底机制
export function testFallbackMechanism(
	document: vscode.TextDocument,
	selection: vscode.Selection,
	variableName: string
): { success: boolean; position: InsertionPosition | null; method: string } {
	try {
		console.log(`[LOGRUSH TEST] 测试变量: ${variableName}`);

		// 尝试正常查找
		const normalResult = findValidInsertionPoint(
			document,
			selection,
			variableName
		);
		if (normalResult) {
			return {
				success: true,
				position: normalResult,
				method: "normal",
			};
		}

		// 尝试兜底机制
		const fallbackResult = createSafeInsertionPosition(
			document,
			selection,
			true
		);
		return {
			success: true,
			position: fallbackResult,
			method: "fallback",
		};
	} catch (error) {
		console.error(`[LOGRUSH TEST] 测试失败:`, error);
		return {
			success: false,
			position: null,
			method: "failed",
		};
	}
}

// 工具函数：获取调试信息
export function getDebugInfo(): string {
	return `[LOGRUSH] CodeAnalyzer - Enhanced fallback mechanism enabled`;
}

export { LogLevel };
