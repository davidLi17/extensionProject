import * as vscode from "vscode";
import { VSCodeHelper } from ".";
type LogType = (typeof LogHighlighter.LOG_TYPES)[number];
export class LogHighlighter {
  // Constants and configuration
  public static readonly LOG_TYPES = [
    "log",
    "warn",
    "error",
    "info",
    "debug",
  ] as const;
  private static readonly LOG_ICONS: Record<LogType, string> = {
    log: "⭐️ log:",
    warn: "⚠️ warn:",
    error: "❌ error:",
    info: "ℹ️ info:",
    debug: "🔍 debug:",
  };
  private static readonly LOG_COLORS: Record<LogType, string> = {
    log: "deepskyblue",
    warn: "orange",
    error: "red",
    info: "lightgreen",
    debug: "gray",
  };

  // State variables
  private static logDecorationTypes: Record<
    string,
    vscode.TextEditorDecorationType
  > = {};
  private static logPositions: vscode.Range[] = [];
  private static currentIndex: number = -1;
  private static statusBarItem: vscode.StatusBarItem;
  private static highlightEnabled: boolean = true;
  private static previousCursorPosition: vscode.Position | null = null;
  private static currentRevealType: vscode.TextEditorRevealType | null = null;

  // Initialize the highlighter
  static initialize(context: vscode.ExtensionContext): void {
    // Read configuration and create decorations
    this.updateFromConfig();

    // Create and configure status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.text = "$(search)LogRush🚀: 0/0 日志";
    this.statusBarItem.tooltip = "点击在日志语句间导航";
    this.statusBarItem.command = "log-rush.nextLog";
    context.subscriptions.push(this.statusBarItem);

    // Register event listeners
    this.registerEventListeners(context);

    // Initial update for current editor
    if (vscode.window.activeTextEditor) {
      this.updateHighlights(vscode.window.activeTextEditor);
    }
  }

  // Register all event listeners
  private static registerEventListeners(
    context: vscode.ExtensionContext
  ): void {
    // Listen for document changes
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        this.updateHighlights(editor);
      }
    });

    // Listen for editor switches
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        this.updateHighlights(editor);
      }
    });

    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("log-rush")) {
        this.updateFromConfig();
        if (vscode.window.activeTextEditor) {
          if (this.highlightEnabled) {
            this.updateHighlights(vscode.window.activeTextEditor);
          } else {
            this.clearAllDecorations(vscode.window.activeTextEditor);
          }
        }
      }
    });

    // Register commands
    context.subscriptions.push(
      vscode.commands.registerCommand("log-rush.toggleHighlight", () =>
        this.toggleHighlight()
      ),
      vscode.commands.registerCommand("log-rush.nextLog", () => {
        this.navigateToLog(true);
      }),
      vscode.commands.registerCommand("log-rush.previousLog", () => {
        this.navigateToLog(false);
      }),
      vscode.commands.registerCommand("log-rush.recenterTop", () =>
        this.recenterTop()
      )
    );
  }

  // Get configuration settings
  private static getConfig() {
    const config = vscode.workspace.getConfiguration("log-rush");
    return {
      enableHighlight: config.get<boolean>("EnableHighlight", true),
    };
  }

  // Update settings from configuration
  private static updateFromConfig(): void {
    // Update highlight enabled state
    const config = this.getConfig();
    this.highlightEnabled = config.enableHighlight;

    // Dispose existing decoration types
    Object.values(this.logDecorationTypes).forEach((decoration) =>
      decoration.dispose()
    );

    // Create new decoration types
    this.logDecorationTypes = {};
    for (const type of this.LOG_TYPES) {
      this.logDecorationTypes[type] =
        vscode.window.createTextEditorDecorationType({
          before: {
            contentText: this.LOG_ICONS[type],
            margin: "0 0.5em 0 0",
            color: this.LOG_COLORS[type],
          },
        });
    }
  }

  // Clear all decorations
  private static clearAllDecorations(editor: vscode.TextEditor): void {
    Object.values(this.logDecorationTypes).forEach((decorationType) => {
      editor.setDecorations(decorationType, []);
    });
  }

  // Update highlights in editor
  static updateHighlights(editor: vscode.TextEditor): void {
    if (!this.highlightEnabled) {
      return;
    }

    const document = editor.document;
    this.logPositions = [];

    // Prepare decoration arrays
    const decorations: Record<string, vscode.Range[]> = {};
    this.LOG_TYPES.forEach((type) => {
      decorations[type] = [];
    });

    // Find all log statements
    const text = document.getText();
    const consoleRegex = /console\.(log|warn|error|info|debug)/g;
    let match;

    while ((match = consoleRegex.exec(text)) !== null) {
      const logType = match[1];
      const startPos = document.positionAt(match.index);
      const line = document.lineAt(startPos.line);
      const range = new vscode.Range(startPos, line.range.end);

      this.logPositions.push(range);
      decorations[logType].push(range);
    }

    // Apply decorations
    Object.keys(this.logDecorationTypes).forEach((type) => {
      editor.setDecorations(this.logDecorationTypes[type], decorations[type]);
    });

    // Update status bar
    this.updateStatusBar();
  }

  static toggleHighlight() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    this.highlightEnabled = !this.highlightEnabled;

    // 同时更新配置文件，使用户配置与当前状态同步
    vscode.workspace
      .getConfiguration("log-rush")
      .update(
        "EnableHighlight",
        this.highlightEnabled,
        vscode.ConfigurationTarget.Global
      );

    if (!this.highlightEnabled) {
      // 如果禁用高亮，清除所有类型的高亮
      Object.values(this.logDecorationTypes).forEach((decorationType) => {
        editor.setDecorations(decorationType, []);
      });
      this.statusBarItem.text = "$(eye-closed) LogRush🚀: 已禁用";
    } else {
      this.updateHighlights(editor);
    }
    this.statusBarItem.show();
  }

  // Navigate between log statements
  static navigateToLog(forward: boolean): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || this.logPositions.length === 0) {
      return;
    }

    if (forward) {
      this.currentIndex = (this.currentIndex + 1) % this.logPositions.length;
    } else {
      this.currentIndex =
        (this.currentIndex - 1 + this.logPositions.length) %
        this.logPositions.length;
    }

    const targetRange = this.logPositions[this.currentIndex];

    // Select and scroll to the current log
    editor.selection = new vscode.Selection(
      targetRange.start,
      targetRange.start
    );
    editor.revealRange(targetRange, vscode.TextEditorRevealType.InCenter);

    this.updateStatusBar();
  }

  // Implement recenter-top functionality
  static recenterTop(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const cursorPosition = editor.selection.active;

    // Determine next reveal type
    if (
      !this.currentRevealType ||
      (this.previousCursorPosition &&
        !cursorPosition.isEqual(this.previousCursorPosition))
    ) {
      // First call or cursor position changed, reset to center
      this.currentRevealType = vscode.TextEditorRevealType.InCenter;
    } else if (
      this.currentRevealType === vscode.TextEditorRevealType.InCenter
    ) {
      // Last time was center, now top
      this.currentRevealType = vscode.TextEditorRevealType.AtTop;
    } else {
      // Other cases (including last time was top), back to center
      this.currentRevealType = vscode.TextEditorRevealType.InCenter;
    }

    // Save current cursor position for next use
    this.previousCursorPosition = cursorPosition;

    // Perform scrolling
    editor.revealRange(
      new vscode.Range(cursorPosition, cursorPosition),
      this.currentRevealType
    );
  }

  // Update status bar information
  static updateStatusBar(): void {
    if (!this.highlightEnabled) {
      this.statusBarItem.text = "$(eye-closed) LogRush🚀: 已禁用";
      this.statusBarItem.tooltip =
        "点击启用日志高亮 (或使用命令: LogRush: 配置高亮设置)";
      this.statusBarItem.show();
      return;
    }

    if (this.logPositions.length > 0) {
      if (this.currentIndex === -1) {
        this.currentIndex = 0;
      }

      this.statusBarItem.text = `$(search) ${this.currentIndex + 1}/${
        this.logPositions.length
      } 日志`;
      this.statusBarItem.tooltip =
        "点击在日志语句间导航\n使用命令 LogRush: 配置高亮设置 可自定义高亮样式";
    } else {
      this.statusBarItem.text = "$(search) LogRush🚀: 无日志";
      this.statusBarItem.tooltip = "当前文件未找到日志语句";
    }

    this.statusBarItem.show();
  }
}
