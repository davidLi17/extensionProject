import * as vscode from "vscode";
import * as path from "path";
import {
	findValidInsertionPoint,
	validateInsertionPosition,
	createSafeInsertionPosition,
} from "@/utils/codeAnalyzer";
import {
	LogConfig,
	LogFormatType,
	LogType,
	LanguageSpecificMethods,
} from "@/types/index";
import { LogHighlighter } from "@/utils/logHighlighter";
import { getEnclosingContextName } from "@/utils/codeAnalyzer/analyzers/contextAnalyzer";
import {
	debugCodeAnalysis,
	debugObjectMethodAnalysis,
} from "@/utils/codeAnalyzer/analyzers/debugAnalyzer";

function getLogConfig(): LogConfig {
	const logOption = vscode.workspace.getConfiguration("log-rush");

	return {
		logMethod: logOption.get("LogMethod") || "console.log",
		varPilotSymbol: logOption.get("VarPilotSymbol") || "::",
		quotationMark: logOption.get("QuotationMark") === "single" ? `'` : `"`,
		showLogSemicolon: logOption.get("ShowLogSemicolon") || false,
		showLineNumber: logOption.get("ShowLineTag") || false,
		showFilePath: logOption.get("ShowFilePath") || false,
		filePathType: logOption.get("FilePathType") || LogFormatType.SHORT,
		lineTagPosition: logOption.get("LineTagAtBeginOrEnd") || "begin",
		customFormat:
			logOption.get("CustomFormat") ||
			"${filePath}: ${functionName}->${varName}${varPilotSymbol}",
		enableCustomLogMethod: logOption.get("EnableCustomLogMethod") || false,
		languageSpecificMethods: logOption.get("LanguageSpecificMethods") || {
			python: "print",
			javascript: "console.log",
			typescript: "console.log",
			java: "System.out.println",
			csharp: "Console.WriteLine",
			cpp: "std::cout",
			c: "printf",
			go: "fmt.Println",
			rust: "println!",
			php: "echo",
			ruby: "puts",
		},
		autoDetectLanguage: logOption.get("AutoDetectLanguage") || true,
	};
}

function getLogEnd(config: LogConfig): string {
	return config.showLogSemicolon ? ");" : ")";
}

export function normalizePath(inputPath: string): string {
	return inputPath.replace(/\\/g, "/");
}

export function getFileInfo(document: vscode.TextDocument) {
	// 获取文件名并去掉扩展名
	const fileName = path.basename(document.fileName);

	// 获取文件目录路径并标准化
	const fileDir = normalizePath(path.dirname(document.fileName));

	// 获取最后一级目录名称
	const dirName = path.basename(fileDir);

	// 生成相对路径并标准化
	const relativePath = normalizePath(path.join(dirName, fileName));

	return { fileName, fileDir, relativePath };
}

function generateLogStatement(
	document: vscode.TextDocument,
	insertSection: vscode.Selection,
	word: string,
	config: LogConfig,
	logMethod: string = config.logMethod
): string {
	// 获取文件信息
	const fileName = path.basename(document.fileName);

	const fileDir = normalizePath(path.dirname(document.fileName));
	const dirName = path.basename(fileDir);
	const relativePath = normalizePath(path.join(dirName, fileName));

	// 获取行号信息
	const lineNumber = config.showLineNumber
		? `l:${insertSection.end.line + 1}`
		: "";

	// 获取函数名和对象名信息
	const contextInfo = getEnclosingContextName(document, insertSection.start);
	const functionName = contextInfo.functionName || "";
	const objectName = contextInfo.objectName || "";

	// 构建上下文路径
	let contextPath = "";
	if (objectName && functionName) {
		contextPath = `${objectName}->${functionName}`;
	} else if (functionName) {
		contextPath = functionName;
	} else {
		contextPath = "";
	}

	// 构建文件路径部分
	let filePathStr = "";
	if (config.showFilePath) {
		switch (config.filePathType) {
			case LogFormatType.SHORT:
				filePathStr = fileName;
				break;
			case LogFormatType.FULL:
				filePathStr = relativePath;
				break;
			case LogFormatType.CUSTOM:
				filePathStr = normalizePath(document.fileName);
				break;
		}
	}

	// 构建日志前缀
	let logPrefix = "";

	if (config.customFormat && config.filePathType === LogFormatType.CUSTOM) {
		// 使用自定义格式:
		logPrefix = config.customFormat
			.replace("${fileName}", fileName)
			.replace("${filePath}", relativePath)
			.replace("${fullPath}", normalizePath(document.fileName))
			.replace("${functionName}", functionName)
			.replace("${objectName}", objectName)
			.replace("${contextPath}", contextPath)
			.replace("${varName}", word)
			.replace("${lineNumber}", lineNumber)
			.replace("${varPilotSymbol}", config.varPilotSymbol);
	} else if (config.filePathType === LogFormatType.SHORT) {
		// user 选择 short模式,最终打印:console.log("varName::", varName);
		const contextDisplay = contextPath ? `${contextPath}->` : "";

		if (config.lineTagPosition === "begin" && lineNumber) {
			logPrefix = `${lineNumber} ${word}${config.varPilotSymbol}`;
		} else {
			logPrefix = `${word}${config.varPilotSymbol}`;
			if (lineNumber) {
				logPrefix += ` ${lineNumber}`;
			}
		}
	} else if (config.filePathType === LogFormatType.FULL) {
		// user 选择 full模式,最终打印:console.log("ctrl-key/quickLog.ts ${contextPath} varName::", varName);
		const contextDisplay = contextPath ? `${contextPath}->` : "";
		if (config.lineTagPosition === "begin" && lineNumber) {
			logPrefix = `${lineNumber} ${filePathStr} ${contextDisplay}${word}${config.varPilotSymbol}`;
		} else {
			logPrefix = `${filePathStr} ${contextDisplay}${word}${config.varPilotSymbol}`;
			if (lineNumber) {
				logPrefix += ` ${lineNumber}`;
			}
		}
	}

	// 使用新的语言特定格式化函数
	return formatLogStatementForLanguage(
		document,
		logMethod,
		logPrefix,
		word,
		config
	);
}

function insertConsoleLog(logType: LogType) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}

	const document = editor.document;
	const varSelection = editor.selection;
	const position = editor.selection.active;
	const word = document.getText(varSelection);
	const config = getLogConfig();
	const logMethod = getLogMethodForDocument(document, config, logType);

	// 没有选择变量的情况，使用带路径信息的snippet
	if (!word) {
		// 获取文件信息
		const fileName = path.basename(document.fileName);
		const fileDir = normalizePath(path.dirname(document.fileName));
		const dirName = path.basename(fileDir);
		const relativePath = normalizePath(path.join(dirName, fileName));

		// 获取行号信息
		const lineNumber = config.showLineNumber
			? `l:${varSelection.end.line + 1}`
			: "";

		// 获取函数名和对象名信息
		const contextInfo = getEnclosingContextName(document, varSelection.start);
		const functionName = contextInfo.functionName || "";
		const objectName = contextInfo.objectName || "";

		// 构建上下文路径
		let contextPath = "";
		if (objectName && functionName) {
			contextPath = `${objectName}->${functionName}`;
		} else if (functionName) {
			contextPath = functionName;
		} else {
			contextPath = "";
		}

		// 构建文件路径部分
		let filePathStr = "";
		if (config.showFilePath) {
			switch (config.filePathType) {
				case LogFormatType.SHORT:
					filePathStr = fileName;
					break;
				case LogFormatType.FULL:
					filePathStr = relativePath;
					break;
				case LogFormatType.CUSTOM:
					filePathStr = normalizePath(document.fileName);
					break;
			}
		}

		// 构建日志前缀
		let logPrefix = "";
		const placeholderVar = "$1"; // 使用snippet的占位符

		if (config.customFormat && config.filePathType === LogFormatType.CUSTOM) {
			// 使用自定义格式
			logPrefix = config.customFormat
				.replace("${fileName}", fileName)
				.replace("${filePath}", relativePath)
				.replace("${fullPath}", normalizePath(document.fileName))
				.replace("${functionName}", functionName)
				.replace("${objectName}", objectName)
				.replace("${contextPath}", contextPath)
				.replace("${varName}", placeholderVar)
				.replace("${lineNumber}", lineNumber)
				.replace("${varPilotSymbol}", config.varPilotSymbol);
		} else if (
			config.filePathType === LogFormatType.SHORT ||
			config.filePathType === LogFormatType.FULL
		) {
			// 使用标准格式
			const contextDisplay = contextPath ? `${contextPath}->` : "";

			if (config.lineTagPosition === "begin" && lineNumber) {
				logPrefix = `${lineNumber} ${filePathStr} ${contextDisplay}${placeholderVar}${config.varPilotSymbol}`;
			} else {
				logPrefix = `${filePathStr} ${contextDisplay}${placeholderVar}${config.varPilotSymbol}`;
				if (lineNumber) {
					logPrefix += ` ${lineNumber}`;
				}
			}
		}

		const value = new vscode.SnippetString(
			formatLogStatementForLanguage(
				document,
				logMethod,
				logPrefix,
				"$1",
				config
			)
		);
		editor.insertSnippet(value, varSelection.start);
		return;
	}

	// 选择了变量的情况 - 使用增强的查找逻辑
	try {
		let insertPosition = findValidInsertionPoint(document, varSelection, word);

		// 验证和修正插入位置
		if (insertPosition) {
			insertPosition = validateInsertionPosition(document, insertPosition);
		} else {
			// 如果findValidInsertionPoint返回null，使用安全的兜底位置
			console.warn(`[LOGRUSH] 未找到变量 ${word} 的合适插入位置，使用兜底策略`);
			insertPosition = createSafeInsertionPosition(
				document,
				varSelection,
				true
			);
		}

		const position = new vscode.Position(
			insertPosition.line,
			insertPosition.character
		);

		// 生成日志语句
		const logStatement = generateLogStatement(
			document,
			varSelection,
			word,
			config,
			logMethod
		);

		// 插入日志语句的安全方法
		const insertLogSafely = async () => {
			try {
				if (insertPosition.isEndOfStatement) {
					// 在语句结束后插入新行
					await editor.edit((editBuilder) => {
						editBuilder.insert(position, "\n");
					});

					const newPosition = new vscode.Position(position.line + 1, 0);
					await editor.edit((editBuilder) => {
						editBuilder.insert(newPosition, logStatement);
					});

					// 移动光标到插入语句的末尾
					const endPosition = new vscode.Position(
						newPosition.line,
						newPosition.character + logStatement.length
					);
					editor.selection = new vscode.Selection(endPosition, endPosition);
				} else {
					// 插入到下一行
					await vscode.commands.executeCommand("editor.action.insertLineAfter");
					const insertSection = editor.selection;

					await editor.edit((editBuilder) => {
						editBuilder.insert(insertSection.start, logStatement);
					});

					// 移动光标到插入语句的末尾
					const endPosition = new vscode.Position(
						insertSection.start.line,
						insertSection.start.character + logStatement.length
					);
					editor.selection = new vscode.Selection(endPosition, endPosition);
				}

				// 更新高亮
				setTimeout(() => {
					if (editor) {
						LogHighlighter.updateHighlights(editor);
					}
				}, 100);
			} catch (error) {
				console.error(`[LOGRUSH] 插入日志语句失败:`, error);

				// 最后的兜底策略：直接在当前行后插入
				try {
					await vscode.commands.executeCommand("editor.action.insertLineAfter");
					const fallbackSelection = editor.selection;

					await editor.edit((editBuilder) => {
						editBuilder.insert(fallbackSelection.start, logStatement);
					});

					vscode.window.showInformationMessage(
						`[LOGRUSH] 已使用兜底策略插入日志，请检查位置是否合适`
					);
				} catch (fallbackError) {
					console.error(`[LOGRUSH] 兜底策略也失败了:`, fallbackError);
					vscode.window.showErrorMessage(
						`[LOGRUSH] 插入日志失败，请手动添加日志语句`
					);
				}
			}
		};

		// 执行插入
		insertLogSafely();
	} catch (error) {
		console.error(`[LOGRUSH] 处理变量 ${word} 时出错:`, error);

		// 出错时的兜底策略
		vscode.commands.executeCommand("editor.action.insertLineAfter").then(() => {
			const insertSelection = editor.selection;
			const logStatement = generateLogStatement(
				document,
				insertSelection,
				word,
				config,
				logMethod
			);

			editor
				.edit((editBuilder) => {
					editBuilder.insert(insertSelection.start, logStatement);
				})
				.then(() => {
					const endPosition = new vscode.Position(
						insertSelection.start.line,
						insertSelection.start.character + logStatement.length
					);
					editor.selection = new vscode.Selection(endPosition, endPosition);

					setTimeout(() => {
						if (editor) {
							LogHighlighter.updateHighlights(editor);
						}
					}, 100);
				});
		});
	}
}

/**
 * 检测当前文档的语言并返回相应的日志方法
 */
function getLogMethodForDocument(
	document: vscode.TextDocument,
	config: LogConfig,
	logType: LogType
): string {
	// 如果启用了自定义日志方法，直接使用配置的方法
	if (config.enableCustomLogMethod) {
		return config.logMethod;
	}

	// 如果启用了自动语言检测
	if (config.autoDetectLanguage) {
		const languageId = document.languageId;
		const languageMethod = config.languageSpecificMethods[languageId];

		if (languageMethod) {
			// 对于支持多种日志级别的语言（如JavaScript/TypeScript），保持原有逻辑
			if (languageId === "javascript" || languageId === "typescript") {
				return `console.${logType}`;
			}
			// 对于其他语言，直接使用配置的方法
			return languageMethod;
		}
	}

	// 兜底：使用传统的console.logType格式
	return `console.${logType}`;
}

/**
 * 根据语言生成合适的日志语句格式
 */
function formatLogStatementForLanguage(
	document: vscode.TextDocument,
	logMethod: string,
	logPrefix: string,
	word: string,
	config: LogConfig
): string {
	const languageId = document.languageId;

	switch (languageId) {
		case "python":
			// Python: print(f"prefix: {variable}")
			if (word) {
				return `${logMethod}(f${config.quotationMark}${logPrefix}{${word}}${config.quotationMark})`;
			} else {
				return `${logMethod}(f${config.quotationMark}${logPrefix}${config.quotationMark})`;
			}

		case "java":
			// Java: System.out.println("prefix: " + variable);
			if (word) {
				return `${logMethod}(${config.quotationMark}${logPrefix}${
					config.quotationMark
				} + ${word})${config.showLogSemicolon ? ";" : ""}`;
			} else {
				return `${logMethod}(${config.quotationMark}${logPrefix}${
					config.quotationMark
				})${config.showLogSemicolon ? ";" : ""}`;
			}

		case "csharp":
			// C#: Console.WriteLine($"prefix: {variable}");
			if (word) {
				return `${logMethod}($${config.quotationMark}${logPrefix}{${word}}${
					config.quotationMark
				})${config.showLogSemicolon ? ";" : ""}`;
			} else {
				return `${logMethod}($${config.quotationMark}${logPrefix}${
					config.quotationMark
				})${config.showLogSemicolon ? ";" : ""}`;
			}

		case "cpp":
		case "c":
			// C++: std::cout << "prefix: " << variable << std::endl;
			if (word) {
				return `${logMethod} << ${config.quotationMark}${logPrefix}${
					config.quotationMark
				} << ${word} << std::endl${config.showLogSemicolon ? ";" : ""}`;
			} else {
				return `${logMethod} << ${config.quotationMark}${logPrefix}${
					config.quotationMark
				} << std::endl${config.showLogSemicolon ? ";" : ""}`;
			}

		case "go":
			// Go: fmt.Println("prefix:", variable)
			if (word) {
				return `${logMethod}(${config.quotationMark}${logPrefix}${config.quotationMark}, ${word})`;
			} else {
				return `${logMethod}(${config.quotationMark}${logPrefix}${config.quotationMark})`;
			}

		case "rust":
			// Rust: println!("prefix: {}", variable);
			if (word) {
				return `${logMethod}(${config.quotationMark}${logPrefix}{}${
					config.quotationMark
				}, ${word})${config.showLogSemicolon ? ";" : ""}`;
			} else {
				return `${logMethod}(${config.quotationMark}${logPrefix}${
					config.quotationMark
				})${config.showLogSemicolon ? ";" : ""}`;
			}

		case "php":
			// PHP: echo "prefix: " . $variable;
			if (word) {
				return `${logMethod} ${config.quotationMark}${logPrefix}${
					config.quotationMark
				} . ${word}${config.showLogSemicolon ? ";" : ""}`;
			} else {
				return `${logMethod} ${config.quotationMark}${logPrefix}${
					config.quotationMark
				}${config.showLogSemicolon ? ";" : ""}`;
			}

		case "ruby":
			// Ruby: puts "prefix: #{variable}"
			if (word) {
				return `${logMethod} ${config.quotationMark}${logPrefix}#{${word}}${config.quotationMark}`;
			} else {
				return `${logMethod} ${config.quotationMark}${logPrefix}${config.quotationMark}`;
			}

		default:
			// 默认JavaScript/TypeScript格式
			return `${logMethod}(${config.quotationMark}${logPrefix}${
				config.quotationMark
			}, ${word}${getLogEnd(config)}`;
	}
}

const quickLog = vscode.commands.registerTextEditorCommand(
	"log-rush.qlog",
	function () {
		insertConsoleLog(LogType.LOG);
	}
);
const quickError = vscode.commands.registerTextEditorCommand(
	"log-rush.qerror",
	function () {
		insertConsoleLog(LogType.ERROR);
	}
);
const quickWarn = vscode.commands.registerTextEditorCommand(
	"log-rush.qwarn",
	function () {
		insertConsoleLog(LogType.WARN);
	}
);
const quickInfo = vscode.commands.registerTextEditorCommand(
	"log-rush.qinfo",
	function () {
		insertConsoleLog(LogType.INFO);
	}
);

// 新增：通用自定义日志插入命令
const quickCustomLog = vscode.commands.registerTextEditorCommand(
	"log-rush.qcustom",
	function () {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const document = editor.document;
		const varSelection = editor.selection;
		const word = document.getText(varSelection);
		const config = getLogConfig();

		// 强制使用自定义日志方法
		const customConfig = { ...config, enableCustomLogMethod: true };
		const logMethod = customConfig.logMethod;

		// 如果没有选择变量，使用snippet
		if (!word) {
			// 获取文件信息和构建前缀的逻辑（简化版）
			const fileName = path.basename(document.fileName);
			const fileDir = normalizePath(path.dirname(document.fileName));
			const dirName = path.basename(fileDir);
			const relativePath = normalizePath(path.join(dirName, fileName));

			let logPrefix = "";
			if (customConfig.showFilePath) {
				switch (customConfig.filePathType) {
					case LogFormatType.SHORT:
						logPrefix = fileName;
						break;
					case LogFormatType.FULL:
						logPrefix = relativePath;
						break;
					case LogFormatType.CUSTOM:
						logPrefix = normalizePath(document.fileName);
						break;
				}
			}

			// 添加变量占位符
			if (logPrefix) {
				logPrefix += ` $1${customConfig.varPilotSymbol}`;
			} else {
				logPrefix = `$1${customConfig.varPilotSymbol}`;
			}

			const value = new vscode.SnippetString(
				formatLogStatementForLanguage(
					document,
					logMethod,
					logPrefix,
					"$1",
					customConfig
				)
			);
			editor.insertSnippet(value, varSelection.start);
			return;
		}

		// 有选择变量的情况，直接插入到下一行
		vscode.commands.executeCommand("editor.action.insertLineAfter").then(() => {
			const insertSelection = editor.selection;
			const logStatement = generateLogStatement(
				document,
				insertSelection,
				word,
				customConfig,
				logMethod
			);

			editor
				.edit((editBuilder) => {
					editBuilder.insert(insertSelection.start, logStatement);
				})
				.then(() => {
					const endPosition = new vscode.Position(
						insertSelection.start.line,
						insertSelection.start.character + logStatement.length
					);
					editor.selection = new vscode.Selection(endPosition, endPosition);

					setTimeout(() => {
						if (editor) {
							LogHighlighter.updateHighlights(editor);
						}
					}, 100);
				});
		});
	}
);

export { quickLog, quickError, quickWarn, quickInfo, quickCustomLog };
