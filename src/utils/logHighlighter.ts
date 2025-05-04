import * as vscode from "vscode"; // 导入vscode模块，提供扩展开发相关的API
import { VSCodeHelper } from "."; // 从当前目录导入VSCodeHelper（可能是其他辅助函数或类）
// 定义一个类型别名LogType，它表示LogHighlighter.LOG_TYPES数组中的某一项的类型（字符串字面量类型）
type LogType = (typeof LogHighlighter.LOG_TYPES)[number];

// 定义一个类，名为LogHighlighter，用于实现日志高亮和导航功能
export class LogHighlighter {
	// 定义静态常量数组LOG_TYPES，包含各种日志类型（log,warn,error等），用const断言确保类型不变
	public static readonly LOG_TYPES = [
		"log",
		"warn",
		"error",
		"info",
		"debug",
	] as const;

	// 定义一个静态只读对象LOG_ICONS，记录每个日志类型对应的前置图标或标识字符
	private static readonly LOG_ICONS: Record<LogType, string> = {
		log: "⭐️ log:", // 普通日志
		warn: "⚠️ warn:", // 警告日志
		error: "❌ error:", // 错误日志
		info: "ℹ️ info:", // 信息日志
		debug: "🔍 debug:", // 调试日志
	};

	// 定义一个静态只读对象LOG_COLORS，记录每个日志类型对应的显示颜色
	private static readonly LOG_COLORS: Record<LogType, string> = {
		log: "deepskyblue", // 蓝色
		warn: "orange", // 橙色
		error: "red", // 红色
		info: "lightgreen", // 浅绿色
		debug: "gray", // 灰色
	};

	// 定义一个静态对象logDecorationTypes，用于存储每种日志类型对应的装饰类型（高亮样式）
	private static logDecorationTypes: Record<
		string,
		vscode.TextEditorDecorationType
	> = {};

	// 存储所有找到的日志位置（范围）数组
	private static logPositions: vscode.Range[] = [];

	// 当前高亮的日志索引，用于导航（初始值-1表示未定位到）
	private static currentIndex: number = -1;

	// 状态条（底部信息栏）显示对象
	private static statusBarItem: vscode.StatusBarItem;

	// 控制是否启用高亮显示的布尔值
	private static highlightEnabled: boolean = true;

	// 记录上一次光标位置，用于决定是否切换不同的视角（隐藏或显示内容）
	private static previousCursorPosition: vscode.Position | null = null;

	// 当前的视图滚动类型（居中或顶部）
	private static currentRevealType: vscode.TextEditorRevealType | null = null;

	// 初始化方法，用于设置扩展的一些状态和事件监听
	static initialize(context: vscode.ExtensionContext): void {
		this.updateFromConfig(); // 从配置文件读取设置
		// 创建状态条对象，放在右侧（Vscode.StatusBarAlignment.Right），优先级100
		this.statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Right,
			100
		);
		// 设置状态条显示文本，带图标和初始信息（已找到0/0个日志）
		this.statusBarItem.text = "$(search)LogRush🚀: 0/0 日志";
		// 设置悬浮提示信息
		this.statusBarItem.tooltip = "点击在日志语句间导航";
		// 设置点击状态栏时执行的命令
		this.statusBarItem.command = "log-rush.nextLog";
		// 添加状态条到扩展的订阅列表，以便扩展关闭时自动清除
		context.subscriptions.push(this.statusBarItem);
		// 注册各种事件监听，比如文本变化、激活文件、配置变化
		this.registerEventListeners(context);
		// 如果当前有激活的编辑器，更新其高亮
		if (vscode.window.activeTextEditor) {
			this.updateHighlights(vscode.window.activeTextEditor);
		}
	}

	// 注册事件监听方法，监控文本变化、编辑器切换、配置变化等
	private static registerEventListeners(
		context: vscode.ExtensionContext
	): void {
		// 监听文档内容变化事件
		vscode.workspace.onDidChangeTextDocument((event) => {
			const editor = vscode.window.activeTextEditor;
			if (editor && event.document === editor.document) {
				this.updateHighlights(editor); // 文档变化时更新高亮
			}
		});

		// 监听激活的编辑器变化事件
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (editor) {
				this.updateHighlights(editor); // 切换编辑器时更新高亮
			}
		});

		// 监听配置文件变化事件
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration("log-rush")) {
				this.updateFromConfig(); // 重新读取配置
				if (vscode.window.activeTextEditor) {
					if (this.highlightEnabled) {
						this.updateHighlights(vscode.window.activeTextEditor); // 配置开启时更新高亮
					} else {
						this.clearAllDecorations(vscode.window.activeTextEditor); // 关闭时清除所有高亮
					}
				}
			}
		});

		// 将命令注册到VSCode（包括切换高亮、导航、重置视角等）
		context.subscriptions.push(
			vscode.commands.registerCommand("log-rush.toggleHighlight", () =>
				this.toggleHighlight()
			),
			vscode.commands.registerCommand("log-rush.nextLog", () => {
				this.navigateToLog(true); // 向后跳转到下一个日志
			}),
			vscode.commands.registerCommand("log-rush.previousLog", () => {
				this.navigateToLog(false); // 向前跳转到上一个日志
			}),
			vscode.commands.registerCommand(
				"log-rush.recenterTop",
				() => this.recenterTop() // 重置视角到光标位置
			)
		);
	}

	// 获取配置项的值（主要读取EnableHighlight）
	private static getConfig() {
		const config = vscode.workspace.getConfiguration("log-rush"); // 获取"log-rush"配置块
		return {
			enableHighlight: config.get<boolean>("EnableHighlight", true), // 获取是否启用高亮，默认true
		};
	}

	// 根据配置更新类的状态和样式
	private static updateFromConfig(): void {
		const config = this.getConfig(); // 读取配置
		this.highlightEnabled = config.enableHighlight; // 设置高亮开关
		// 先清除之前的装饰样式
		Object.values(this.logDecorationTypes).forEach((decoration) =>
			decoration.dispose()
		);
		// 重置样式存储对象
		this.logDecorationTypes = {};
		// 根据LOG_TYPES数组，为每一种日志类型创建对应的装饰样式
		for (const type of this.LOG_TYPES) {
			this.logDecorationTypes[type] =
				vscode.window.createTextEditorDecorationType({
					before: {
						contentText: this.LOG_ICONS[type], // 在文本前显示对应图标
						margin: "0 0.5em 0 0", // 图标与文本的间距
						color: this.LOG_COLORS[type], // 图标颜色
					},
				});
		}
	}

	// 清除所有某个编辑器中的装饰（高亮）
	private static clearAllDecorations(editor: vscode.TextEditor): void {
		Object.values(this.logDecorationTypes).forEach((decorationType) => {
			editor.setDecorations(decorationType, []); // 设置为空数组，清除装饰
		});
	}

	// 更新指定编辑器中的高亮信息（查找console语句并高亮）
	static updateHighlights(editor: vscode.TextEditor): void {
		if (!this.highlightEnabled) {
			return; // 如果没有开启高亮，直接返回
		}
		const document = editor.document; // 获取当前文档
		this.logPositions = []; // 清空之前存的日志位置
		const decorations: Record<string, vscode.Range[]> = {}; // 定义存储不同类型高亮范围的对象
		this.LOG_TYPES.forEach((type) => {
			decorations[type] = []; // 初始化每个类型对应的范围数组
		});
		const text = document.getText(); // 获取整个文档文本
		const consoleRegex = /console\.(log|warn|error|info|debug)/g; // 定义匹配console语句的正则表达式
		let match;
		while ((match = consoleRegex.exec(text)) !== null) {
			// 循环匹配所有console调用
			const logType = match[1]; // 获取匹配到的日志类型（log,warn等）
			const startPos = document.positionAt(match.index); // 获取匹配起点在文档中的位置
			const line = document.lineAt(startPos.line); // 获取起点所在行
			const range = new vscode.Range(startPos, line.range.end); // 以起点到行末作为范围
			this.logPositions.push(range); // 存入日志位置数组
			decorations[logType].push(range); // 按类型存入对应数组，方便高亮
		}
		// 对每个日志类型设置对应的高亮样式
		Object.keys(this.logDecorationTypes).forEach((type) => {
			editor.setDecorations(this.logDecorationTypes[type], decorations[type]);
		});
		this.updateStatusBar(); // 更新状态栏显示内容
	}

	// 切换高亮状态（开启或关闭）
	static toggleHighlight() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return; // 如果没有激活的编辑器，直接返回
		}
		this.highlightEnabled = !this.highlightEnabled; // 取反高亮状态
		// 保存新的状态到配置文件（全局范围）
		vscode.workspace
			.getConfiguration("log-rush")
			.update(
				"EnableHighlight",
				this.highlightEnabled,
				vscode.ConfigurationTarget.Global
			);
		if (!this.highlightEnabled) {
			// 关闭时清除所有装饰
			Object.values(this.logDecorationTypes).forEach((decorationType) => {
				editor.setDecorations(decorationType, []);
			});
			// 更新状态栏显示为已禁用
			this.statusBarItem.text = "$(eye-closed) LogRush🚀: 已禁用";
		} else {
			// 开启时重新更新高亮
			this.updateHighlights(editor);
		}
		this.statusBarItem.show(); // 显示状态栏
	}

	// 导航到下一个或上一个日志位置（根据forward布尔值）
	static navigateToLog(forward: boolean): void {
		const editor = vscode.window.activeTextEditor;
		if (!editor || this.logPositions.length === 0) {
			return; // 如果没有激活的编辑器或没有日志，返回
		}
		if (forward) {
			// 往后导航，索引+1，取模防止越界
			this.currentIndex = (this.currentIndex + 1) % this.logPositions.length;
		} else {
			// 往前导航，索引-1，做模运算处理成正数
			this.currentIndex =
				(this.currentIndex - 1 + this.logPositions.length) %
				this.logPositions.length;
		}
		const targetRange = this.logPositions[this.currentIndex]; // 获取目标范围
		// 将光标定位到目标范围起点
		editor.selection = new vscode.Selection(
			targetRange.start,
			targetRange.start
		);
		// 使目标范围居中或顶部显示
		editor.revealRange(targetRange, vscode.TextEditorRevealType.InCenter);
		this.updateStatusBar(); // 更新状态条内容
	}

	// 重置视角，使光标位置显示在顶部或居中
	static recenterTop(): void {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		const cursorPosition = editor.selection.active; // 获取光标当前位置
		// 判断是否切换视角（居中或顶端）
		if (
			!this.currentRevealType ||
			(this.previousCursorPosition &&
				!cursorPosition.isEqual(this.previousCursorPosition))
		) {
			this.currentRevealType = vscode.TextEditorRevealType.InCenter; // 默认居中
		} else if (
			this.currentRevealType === vscode.TextEditorRevealType.InCenter
		) {
			this.currentRevealType = vscode.TextEditorRevealType.AtTop; // 改为顶端
		} else {
			this.currentRevealType = vscode.TextEditorRevealType.InCenter; // 重新居中
		}
		// 记录当前位置
		this.previousCursorPosition = cursorPosition;
		// 执行视图滚动
		editor.revealRange(
			new vscode.Range(cursorPosition, cursorPosition),
			this.currentRevealType
		);
	}

	// 更新状态栏内容（显示当前导航位置或提示信息）
	static updateStatusBar(): void {
		if (!this.highlightEnabled) {
			// 高亮关闭状态
			this.statusBarItem.text = "$(eye-closed) LogRush🚀: 已禁用";
			this.statusBarItem.tooltip =
				"点击启用日志高亮 (或使用命令: LogRush: 配置高亮设置)";
			this.statusBarItem.show();
			return;
		}
		if (this.logPositions.length > 0) {
			// 存在日志位置
			if (this.currentIndex === -1) {
				this.currentIndex = 0; // 初始为第一个
			}
			// 显示当前位置及总数，比如：1/5
			this.statusBarItem.text = `$(search) ${this.currentIndex + 1}/${
				this.logPositions.length
			} 日志`;
			this.statusBarItem.tooltip =
				"点击在日志语句间导航\n使用命令 LogRush: 配置高亮设置 可自定义高亮样式";
		} else {
			// 无日志，提示无内容
			this.statusBarItem.text = "$(search) LogRush🚀: 无日志";
			this.statusBarItem.tooltip = "当前文件未找到日志语句";
		}
		this.statusBarItem.show(); // 显示状态栏
	}
}
