import * as vscode from "vscode"; // 导入VSCode扩展API
import * as path from "path"; // 导入路径处理模块
import * as fs from "fs"; // 导入文件系统模块

// 日志树节点类型
export class LogItem extends vscode.TreeItem {
	constructor(
		public readonly label: string, // 标签，显示在树视图中的文本
		public readonly collapsibleState: vscode.TreeItemCollapsibleState, // 折叠状态
		public readonly filePath: string, // 文件路径
		public readonly lineNumber: number, // 行号
		public readonly fullLine: string // 完整代码行
	) {
		super(label, collapsibleState); // 调用父类构造函数

		// 设置工具提示为完整代码行
		this.tooltip = fullLine.trim();

		// 设置描述信息（文件名和行号）
		this.description = `${path.basename(filePath)}:${lineNumber + 1}`;

		// 设置图标
		this.iconPath = new vscode.ThemeIcon("console");

		// 设置命令（点击时执行）
		this.command = {
			command: "log-rush.openLogLocation", // 命令ID
			title: "打开日志位置", // 命令标题
			arguments: [this.filePath, this.lineNumber], // 命令参数
		};

		// 设置上下文值（用于在右键菜单中过滤）
		this.contextValue = "logItem";
	}
}

// 文件组节点
export class FileGroup extends vscode.TreeItem {
	constructor(
		public readonly label: string, // 标签，显示在树视图中的文本
		public readonly collapsibleState: vscode.TreeItemCollapsibleState, // 折叠状态
		public readonly filePath: string, // 文件路径
		public readonly children: LogItem[] // 子节点列表
	) {
		super(label, collapsibleState); // 调用父类构造函数
		this.description = `(${children.length})`; // 设置描述信息（子节点数量）
		this.tooltip = filePath; // 设置工具提示为文件路径
		this.iconPath = new vscode.ThemeIcon("file"); // 设置图标
		this.contextValue = "fileGroup"; // 设置上下文值（用于在右键菜单中过滤）
	}
}

// 日志树数据提供程序
export class LogExplorerProvider
	implements vscode.TreeDataProvider<LogItem | FileGroup>
{
	private _onDidChangeTreeData: vscode.EventEmitter<
		LogItem | FileGroup | undefined | null | void
	> = new vscode.EventEmitter<LogItem | FileGroup | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<
		LogItem | FileGroup | undefined | null | void
	> = this._onDidChangeTreeData.event;

	private logItems: Map<string, LogItem[]> = new Map(); // 存储日志项的映射
	private currentMode: "currentFile" | "workspace" = "currentFile"; // 当前模式（当前文件或工作区）

	constructor(private context: vscode.ExtensionContext) {
		// 监听文本编辑器变化事件
		vscode.window.onDidChangeActiveTextEditor(() => {
			if (this.currentMode === "currentFile") {
				this.refresh(); // 刷新树视图
			}
		});

		// 监听文档变化事件
		vscode.workspace.onDidChangeTextDocument(() => {
			if (this.currentMode === "currentFile") {
				this.refresh(); // 刷新树视图
			}
		});
	}

	refresh(): void {
		this._onDidChangeTreeData.fire(); // 触发树数据变化事件
	}

	// 切换模式（当前文件/工作区）
	toggleMode(): void {
		this.currentMode =
			this.currentMode === "currentFile" ? "workspace" : "currentFile";
		this.refresh(); // 刷新树视图
	}

	getCurrentMode(): string {
		return this.currentMode; // 获取当前模式
	}

	getTreeItem(element: LogItem | FileGroup): vscode.TreeItem {
		return element; // 返回树节点对象
	}

	async getChildren(
		element?: LogItem | FileGroup
	): Promise<(LogItem | FileGroup)[]> {
		if (element instanceof FileGroup) {
			return element.children; // 如果是文件组节点，返回其子节点
		}

		// 根节点：返回文件组或日志项
		if (!element) {
			await this.findLogs(); // 查找日志

			if (this.currentMode === "currentFile") {
				// 当前文件模式：直接返回日志项
				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					return []; // 如果没有活动的编辑器，返回空数组
				}
				const filePath = editor.document.uri.fsPath;
				return this.logItems.get(filePath) || []; // 返回当前文件的日志项
			} else {
				// 工作区模式：按文件分组
				const fileGroups: FileGroup[] = [];
				this.logItems.forEach((items, filePath) => {
					if (items.length > 0) {
						fileGroups.push(
							new FileGroup(
								path.basename(filePath), // 文件名作为标签
								vscode.TreeItemCollapsibleState.Collapsed, // 折叠状态
								filePath, // 文件路径
								items // 子节点列表
							)
						);
					}
				});
				return fileGroups; // 返回文件组列表
			}
		}

		return []; // 其他情况返回空数组
	}

	private async findLogs(): Promise<void> {
		this.logItems.clear(); // 清空日志项映射

		if (this.currentMode === "currentFile") {
			// 仅在当前文件中搜索
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				await this.findLogsInFile(editor.document); // 在当前文件中查找日志
			}
		} else {
			// 在工作区中搜索
			if (vscode.workspace.workspaceFolders) {
				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification, // 进度条位置
						title: "搜索日志语句中...", // 进度条标题
						cancellable: true, // 可取消
					},
					async (progress, token) => {
						for (const folder of vscode.workspace.workspaceFolders!) {
							if (token.isCancellationRequested) break; // 如果用户取消，则终止

							const pattern = new vscode.RelativePattern(
								folder,
								"**/*.{js,ts,jsx,tsx}" // 匹配文件模式
							);
							const files = await vscode.workspace.findFiles(
								pattern,
								"**/node_modules/**" // 排除node_modules目录
							);

							let processedFiles = 0;
							for (const file of files) {
								if (token.isCancellationRequested) break; // 如果用户取消，则终止

								try {
									const document = await vscode.workspace.openTextDocument(
										file
									);
									await this.findLogsInFile(document); // 在文件中查找日志

									processedFiles++;
									if (processedFiles % 10 === 0) {
										// 每10个文件更新一次进度
										progress.report({
											message: `已处理 ${processedFiles}/${files.length} 个文件`,
											increment: (10 / files.length) * 100,
										});
									}
								} catch (error) {
									console.error(`处理文件时出错 ${file.fsPath}:`, error);
								}
							}
						}
					}
				);
			}
		}
	}

	private async findLogsInFile(document: vscode.TextDocument): Promise<void> {
		const filePath = document.uri.fsPath; // 获取文件路径
		const fileItems: LogItem[] = []; // 存储文件中的日志项

		const text = document.getText(); // 获取文档全文
		const consoleRegex =
			/console\.(log|warn|error|info|debug|table|dir|trace|group|groupCollapsed|groupEnd|clear|count|countReset|time|timeLog)\s*\(/g; // 匹配console方法的正则表达式

		let match;
		while ((match = consoleRegex.exec(text)) !== null) {
			// 获取整行内容
			const position = document.positionAt(match.index);
			const line = document.lineAt(position.line);
			const fullLine = line.text;

			// 提取变量名（如果可能）
			let varName = "日志";
			const argsMatch = fullLine.match(/console\.[^(]+\([^,]*,\s*([^)]+)\)/);
			if (argsMatch && argsMatch[1]) {
				varName = argsMatch[1].trim();
			}

			// 创建有意义的标签
			let label = `${match[1]}: ${varName}`;
			if (label.length > 50) {
				label = label.substring(0, 47) + "...";
			}

			fileItems.push(
				new LogItem(
					label, // 标签
					vscode.TreeItemCollapsibleState.None, // 不可折叠
					filePath, // 文件路径
					position.line, // 行号
					fullLine // 完整代码行
				)
			);
		}

		if (fileItems.length > 0) {
			this.logItems.set(filePath, fileItems); // 将文件中的日志项存储到映射中
		}
	}
}
