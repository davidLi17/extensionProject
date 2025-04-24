// 导入VS Code扩展API模块
import * as vscode from "vscode";
// 导入自定义的VSCodeHelper工具类
import { VSCodeHelper } from ".";
// 定义日志类型，从LOG_TYPES常量中获取
type LogType = (typeof LogHighlighter.LOG_TYPES)[number];

// 日志高亮器主类
export class LogHighlighter {
  // 常量与配置部分
  // 定义支持的日志类型常量数组（使用as const确保类型安全）
  public static readonly LOG_TYPES = [
    "log",
    "warn",
    "error",
    "info",
    "debug",
  ] as const;

  // 定义每种日志类型对应的图标（使用Record类型映射）
  private static readonly LOG_ICONS: Record<LogType, string> = {
    log: "⭐️ log:", // 普通日志图标
    warn: "⚠️ warn:", // 警告日志图标
    error: "❌ error:", // 错误日志图标
    info: "ℹ️ info:", // 信息日志图标
    debug: "🔍 debug:", // 调试日志图标
  };

  // 定义每种日志类型对应的颜色
  private static readonly LOG_COLORS: Record<LogType, string> = {
    log: "deepskyblue", // 天蓝色
    warn: "orange", // 橙色
    error: "red", // 红色
    info: "lightgreen", // 浅绿色
    debug: "gray", // 灰色
  };

  // 状态变量部分
  // 存储每种日志类型的装饰器实例
  private static logDecorationTypes: Record<
    string,
    vscode.TextEditorDecorationType
  > = {};

  // 存储所有日志语句的位置范围
  private static logPositions: vscode.Range[] = [];

  // 当前选中的日志索引（初始为-1表示未选中）
  private static currentIndex: number = -1;

  // 状态栏项目实例
  private static statusBarItem: vscode.StatusBarItem;

  // 高亮功能是否启用标志
  private static highlightEnabled: boolean = true;

  // 上一次光标位置（用于实现recenterTop功能）
  private static previousCursorPosition: vscode.Position | null = null;

  // 当前滚动显示类型（居中或顶部）
  private static currentRevealType: vscode.TextEditorRevealType | null = null;

  // 初始化高亮器
  static initialize(context: vscode.ExtensionContext): void {
    // 从配置文件读取设置并创建装饰器
    this.updateFromConfig();

    // 创建并配置状态栏项目
    // 在状态栏右侧创建项目，优先级为100
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    // 设置状态栏文本（显示日志数量）
    this.statusBarItem.text = "$(search)LogRush🚀: 0/0 日志";
    // 设置鼠标悬停提示
    this.statusBarItem.tooltip = "点击在日志语句间导航";
    // 设置点击命令（跳转到下一条日志）
    this.statusBarItem.command = "log-rush.nextLog";
    // 将状态栏项目注册到上下文，确保扩展卸载时能正确清理
    context.subscriptions.push(this.statusBarItem);

    // 注册所有事件监听器
    this.registerEventListeners(context);

    // 为当前活动编辑器初始化高亮
    if (vscode.window.activeTextEditor) {
      this.updateHighlights(vscode.window.activeTextEditor);
    }
  }

  // 注册所有事件监听器
  private static registerEventListeners(
    context: vscode.ExtensionContext
  ): void {
    // 监听文档内容变化事件
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      // 如果当前活动编辑器且变化的是当前文档
      if (editor && event.document === editor.document) {
        // 更新高亮显示
        this.updateHighlights(editor);
      }
    });

    // 监听活动编辑器切换事件
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        // 切换到新编辑器时更新高亮
        this.updateHighlights(editor);
      }
    });

    // 监听配置变化事件
    vscode.workspace.onDidChangeConfiguration((event) => {
      // 如果log-rush相关配置发生变化
      if (event.affectsConfiguration("log-rush")) {
        // 从配置更新设置
        this.updateFromConfig();
        if (vscode.window.activeTextEditor) {
          if (this.highlightEnabled) {
            // 如果高亮启用，更新高亮
            this.updateHighlights(vscode.window.activeTextEditor);
          } else {
            // 如果高亮禁用，清除所有装饰
            this.clearAllDecorations(vscode.window.activeTextEditor);
          }
        }
      }
    });

    // 注册所有命令
    context.subscriptions.push(
      // 切换高亮显示命令
      vscode.commands.registerCommand("log-rush.toggleHighlight", () =>
        this.toggleHighlight()
      ),
      // 跳转到下一条日志命令
      vscode.commands.registerCommand("log-rush.nextLog", () => {
        this.navigateToLog(true);
      }),
      // 跳转到上一条日志命令
      vscode.commands.registerCommand("log-rush.previousLog", () => {
        this.navigateToLog(false);
      }),
      // 重新定位视图命令（居中/顶部切换）
      vscode.commands.registerCommand("log-rush.recenterTop", () =>
        this.recenterTop()
      )
    );
  }

  // 获取配置设置
  private static getConfig() {
    // 获取log-rush配置节
    const config = vscode.workspace.getConfiguration("log-rush");
    return {
      // 获取高亮启用配置，默认值为true
      enableHighlight: config.get<boolean>("EnableHighlight", true),
    };
  }

  // 从配置更新设置
  private static updateFromConfig(): void {
    // 更新高亮启用状态
    const config = this.getConfig();
    this.highlightEnabled = config.enableHighlight;

    // 释放现有的装饰器实例（避免内存泄漏）
    Object.values(this.logDecorationTypes).forEach((decoration) =>
      decoration.dispose()
    );

    // 创建新的装饰器实例
    this.logDecorationTypes = {};
    // 为每种日志类型创建装饰器
    for (const type of this.LOG_TYPES) {
      this.logDecorationTypes[type] =
        vscode.window.createTextEditorDecorationType({
          before: {
            // 设置装饰器显示内容（图标+类型）
            contentText: this.LOG_ICONS[type],
            // 设置右边距
            margin: "0 0.5em 0 0",
            // 设置颜色
            color: this.LOG_COLORS[type],
          },
        });
    }
  }

  // 清除所有装饰
  private static clearAllDecorations(editor: vscode.TextEditor): void {
    // 遍历所有装饰器类型，清空它们的装饰范围
    Object.values(this.logDecorationTypes).forEach((decorationType) => {
      editor.setDecorations(decorationType, []);
    });
  }

  // 更新编辑器中的高亮显示
  static updateHighlights(editor: vscode.TextEditor): void {
    // 如果高亮功能未启用，直接返回
    if (!this.highlightEnabled) {
      return;
    }

    const document = editor.document;
    // 清空之前的日志位置记录
    this.logPositions = [];

    // 准备装饰范围数组（按日志类型分类）
    const decorations: Record<string, vscode.Range[]> = {};
    this.LOG_TYPES.forEach((type) => {
      decorations[type] = [];
    });

    // 查找所有console日志语句
    const text = document.getText();
    // 匹配console.log/warn/error/info/debug的正则表达式
    const consoleRegex = /console\.(log|warn|error|info|debug)/g;
    let match;

    // 遍历所有匹配项
    while ((match = consoleRegex.exec(text)) !== null) {
      const logType = match[1]; // 获取日志类型
      const startPos = document.positionAt(match.index); // 获取匹配开始位置
      const line = document.lineAt(startPos.line); // 获取整行
      const range = new vscode.Range(startPos, line.range.end); // 创建范围（从匹配开始到行尾）

      // 记录日志位置
      this.logPositions.push(range);
      // 按类型分类装饰范围
      decorations[logType].push(range);
    }

    // 应用装饰到编辑器
    Object.keys(this.logDecorationTypes).forEach((type) => {
      editor.setDecorations(this.logDecorationTypes[type], decorations[type]);
    });

    // 更新状态栏显示
    this.updateStatusBar();
  }

  // 切换高亮显示状态
  static toggleHighlight() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    // 切换高亮启用状态
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
      // 更新状态栏显示为禁用状态
      this.statusBarItem.text = "$(eye-closed) LogRush🚀: 已禁用";
    } else {
      // 如果启用高亮，更新高亮显示
      this.updateHighlights(editor);
    }
    // 显示状态栏
    this.statusBarItem.show();
  }

  // 在日志语句间导航
  static navigateToLog(forward: boolean): void {
    const editor = vscode.window.activeTextEditor;
    // 如果没有活动编辑器或没有日志语句，直接返回
    if (!editor || this.logPositions.length === 0) {
      return;
    }

    // 计算新的日志索引（考虑循环）
    if (forward) {
      // 向前导航（下一个）
      this.currentIndex = (this.currentIndex + 1) % this.logPositions.length;
    } else {
      // 向后导航（上一个）
      this.currentIndex =
        (this.currentIndex - 1 + this.logPositions.length) %
        this.logPositions.length;
    }

    // 获取目标日志的范围
    const targetRange = this.logPositions[this.currentIndex];

    // 选中并滚动到当前日志
    editor.selection = new vscode.Selection(
      targetRange.start,
      targetRange.start
    );
    // 在编辑器中居中显示目标日志
    editor.revealRange(targetRange, vscode.TextEditorRevealType.InCenter);

    // 更新状态栏显示
    this.updateStatusBar();
  }

  // 实现重新定位视图功能（居中/顶部切换）
  static recenterTop(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    // 获取当前光标位置
    const cursorPosition = editor.selection.active;

    // 确定下一个滚动显示类型
    if (
      !this.currentRevealType ||
      (this.previousCursorPosition &&
        !cursorPosition.isEqual(this.previousCursorPosition))
    ) {
      // 第一次调用或光标位置改变，重置为居中
      this.currentRevealType = vscode.TextEditorRevealType.InCenter;
    } else if (
      this.currentRevealType === vscode.TextEditorRevealType.InCenter
    ) {
      // 上次是居中，这次改为顶部
      this.currentRevealType = vscode.TextEditorRevealType.AtTop;
    } else {
      // 其他情况（包括上次是顶部），回到居中
      this.currentRevealType = vscode.TextEditorRevealType.InCenter;
    }

    // 保存当前光标位置供下次使用
    this.previousCursorPosition = cursorPosition;

    // 执行滚动
    editor.revealRange(
      new vscode.Range(cursorPosition, cursorPosition),
      this.currentRevealType
    );
  }

  // 更新状态栏信息
  static updateStatusBar(): void {
    // 如果高亮功能未启用
    if (!this.highlightEnabled) {
      this.statusBarItem.text = "$(eye-closed) LogRush🚀: 已禁用";
      this.statusBarItem.tooltip =
        "点击启用日志高亮 (或使用命令: LogRush: 配置高亮设置)";
      this.statusBarItem.show();
      return;
    }

    // 如果有日志语句
    if (this.logPositions.length > 0) {
      // 如果当前索引未设置（-1），设为0
      if (this.currentIndex === -1) {
        this.currentIndex = 0;
      }

      // 更新状态栏显示当前日志索引/总数
      this.statusBarItem.text = `$(search) ${this.currentIndex + 1}/${
        this.logPositions.length
      } 日志`;
      this.statusBarItem.tooltip =
        "点击在日志语句间导航\n使用命令 LogRush: 配置高亮设置 可自定义高亮样式";
    } else {
      // 没有找到日志语句的情况
      this.statusBarItem.text = "$(search) LogRush🚀: 无日志";
      this.statusBarItem.tooltip = "当前文件未找到日志语句";
    }

    // 显示状态栏
    this.statusBarItem.show();
  }
}
