import * as vscode from "vscode";

export class LogHighlighter {
	// 日志装饰器类型
	private static logDecorationType: vscode.TextEditorDecorationType;
	// 保存当前文件中的所有日志位置
	private static logPositions: vscode.Range[] = [];
	// 当前高亮索引
	private static currentIndex: number = -1;
	// 状态栏项目
	private static statusBarItem: vscode.StatusBarItem;

	//add recenter top
	private static previousCursorPosition: vscode.Position | null = null;
	private static currentRevealType: vscode.TextEditorRevealType | null = null;

	// 实现recenter-top功能，在居中和置顶之间交替
	static recenterTop() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const cursorPosition = editor.selection.active;

		// 决定下一个显示类型
		if (
			!this.currentRevealType ||
			(this.previousCursorPosition &&
				!cursorPosition.isEqual(this.previousCursorPosition))
		) {
			// 首次调用或光标位置改变，重置为居中显示
			this.currentRevealType = vscode.TextEditorRevealType.InCenter;
		} else if (
			this.currentRevealType === vscode.TextEditorRevealType.InCenter
		) {
			// 上次是居中，这次置顶
			this.currentRevealType = vscode.TextEditorRevealType.AtTop;
		} else {
			// 其他情况（包括上次是置顶），回到居中
			this.currentRevealType = vscode.TextEditorRevealType.InCenter;
		}

		// 保存当前光标位置以供下次使用
		this.previousCursorPosition = cursorPosition;

		// 执行滚动
		editor.revealRange(
			new vscode.Range(cursorPosition, cursorPosition),
			this.currentRevealType
		);
	}

	// 初始化高亮器
	static initialize(context: vscode.ExtensionContext) {
		// 创建装饰器
		this.logDecorationType = vscode.window.createTextEditorDecorationType({
			before: {
				contentText: "log:⭐:",
				margin: "0 0.5em 0 0",
				color: "gold",
			},
		});

		// 创建状态栏项目
		this.statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Right,
			100
		);
		this.statusBarItem.text = "$(search)LogRush🚀: 0/0 日志";
		this.statusBarItem.tooltip = "点击在日志语句间导航";
		this.statusBarItem.command = "log-rush.nextLog";
		context.subscriptions.push(this.statusBarItem);

		// 监听文档变化
		vscode.workspace.onDidChangeTextDocument((event) => {
			if (
				vscode.window.activeTextEditor &&
				event.document === vscode.window.activeTextEditor.document
			) {
				this.updateHighlights(vscode.window.activeTextEditor);
			}
		});

		// 监听编辑器切换
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (editor) {
				this.updateHighlights(editor);
			}
		});

		// 首次启动时更新当前编辑器中的高亮
		if (vscode.window.activeTextEditor) {
			this.updateHighlights(vscode.window.activeTextEditor);
		}

		// 注册命令
		context.subscriptions.push(
			vscode.commands.registerCommand("log-rush.toggleHighlight", () => {
				this.toggleHighlight();
			}),
			vscode.commands.registerCommand("log-rush.nextLog", () => {
				this.navigateToLog(true);
			}),
			vscode.commands.registerCommand("log-rush.previousLog", () => {
				this.navigateToLog(false);
			}),
			vscode.commands.registerCommand("log-rush.recenterTop", () => {
				this.recenterTop();
			})
		);
	}

	// 更新高亮显示
	static updateHighlights(editor: vscode.TextEditor) {
		const document = editor.document;
		// 重置位置数组
		this.logPositions = [];

		// 查找所有日志语句
		const text = document.getText();
		const consoleRegex = /console\.(log|warn|error|info|debug)/g;
		let match;

		while ((match = consoleRegex.exec(text)) !== null) {
			const startPos = document.positionAt(match.index);
			// 向后查找整行来找到语句结束位置
			const line = document.lineAt(startPos.line);
			const lineText = line.text;
			const endPos = document.positionAt(match.index + match[0].length);

			// 创建范围
			const range = new vscode.Range(startPos, line.range.end);
			this.logPositions.push(range);
		}

		// 更新装饰器
		editor.setDecorations(this.logDecorationType, this.logPositions);

		// 更新状态栏
		this.updateStatusBar();
	}

	// 切换高亮显示开关
	static toggleHighlight() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;

		if (this.logPositions.length > 0) {
			// 如果有高亮，清除它们
			editor.setDecorations(this.logDecorationType, []);
			this.logPositions = [];
			this.statusBarItem.hide();
		} else {
			// 重新添加高亮
			this.updateHighlights(editor);
			this.statusBarItem.show();
		}
	}

	// 在日志语句间导航
	static navigateToLog(forward: boolean) {
		const editor = vscode.window.activeTextEditor;
		if (!editor || this.logPositions.length === 0) return;

		if (forward) {
			this.currentIndex = (this.currentIndex + 1) % this.logPositions.length;
		} else {
			this.currentIndex =
				(this.currentIndex - 1 + this.logPositions.length) %
				this.logPositions.length;
		}

		// 选择并滚动到当前日志
		editor.selection = new vscode.Selection(
			this.logPositions[this.currentIndex].start,
			this.logPositions[this.currentIndex].start
		);
		editor.revealRange(
			this.logPositions[this.currentIndex],
			vscode.TextEditorRevealType.InCenter
		);

		// 更新状态栏
		this.updateStatusBar();
	}

	// 更新状态栏信息
	static updateStatusBar() {
		if (this.logPositions.length > 0) {
			if (this.currentIndex === -1) this.currentIndex = 0;
			this.statusBarItem.text = `$(search) ${this.currentIndex + 1}/${
				this.logPositions.length
			} 日志`;
			this.statusBarItem.show();
		} else {
			this.statusBarItem.hide();
		}
	}
}
