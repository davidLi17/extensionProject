import * as vscode from "vscode"; // 导入VSCode扩展API
import * as path from "path"; // 导入路径处理模块
import * as fs from "fs"; // 导入文件系统模块

// 日志类型枚举
export enum LogType {
  Log = "log",
  Warn = "warn",
  Error = "error",
  Info = "info",
  Debug = "debug",
  Table = "table",
  Dir = "dir",
  Trace = "trace",
  Group = "group",
  GroupCollapsed = "groupCollapsed",
  GroupEnd = "groupEnd",
  Clear = "clear",
  Count = "count",
  CountReset = "countReset",
  Time = "time",
  TimeLog = "timeLog",
}

// 日志树节点类型
export class LogItem extends vscode.TreeItem {
  constructor(
    public readonly label: string, // 标签，显示在树视图中的文本
    public readonly collapsibleState: vscode.TreeItemCollapsibleState, // 折叠状态
    public readonly fileUri: vscode.Uri, // 文件URI
    public readonly lineNumber: number, // 行号
    public readonly fullLine: string, // 完整代码行
    public readonly logType: LogType // 日志类型
  ) {
    super(label, collapsibleState); // 调用父类构造函数

    // 设置工具提示为完整代码行
    this.tooltip = fullLine.trim();

    // 设置描述信息（文件名和行号）
    this.description = `${path.basename(fileUri.fsPath)}:${lineNumber + 1}`;

    // 设置图标（根据日志类型设置不同图标）
    this.iconPath = this.getIconForLogType(logType);

    // 设置命令（点击时执行）
    this.command = {
      command: "log-rush.openLogLocation", // 命令ID
      title: "打开日志位置", // 命令标题
      arguments: [this.fileUri, this.lineNumber], // 命令参数（现在传递URI而非字符串路径）
    };

    // 设置上下文值（用于在右键菜单中过滤）
    this.contextValue = `logItem.${logType}`;
  }

  // 根据日志类型获取图标
  private getIconForLogType(logType: LogType): vscode.ThemeIcon {
    switch (logType) {
      case LogType.Error:
        return new vscode.ThemeIcon("error");
      case LogType.Warn:
        return new vscode.ThemeIcon("warning");
      case LogType.Debug:
        return new vscode.ThemeIcon("bug");
      case LogType.Info:
        return new vscode.ThemeIcon("info");
      default:
        return new vscode.ThemeIcon("console");
    }
  }
}

// 文件组节点
export class FileGroup extends vscode.TreeItem {
  constructor(
    public readonly label: string, // 标签，显示在树视图中的文本
    public readonly collapsibleState: vscode.TreeItemCollapsibleState, // 折叠状态
    public readonly fileUri: vscode.Uri, // 文件URI
    public readonly children: LogItem[] // 子节点列表
  ) {
    super(label, collapsibleState); // 调用父类构造函数
    this.description = `(${children.length})`; // 设置描述信息（子节点数量）
    this.tooltip = fileUri.fsPath; // 设置工具提示为文件路径
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
  private debounceTimer: NodeJS.Timeout | undefined; // 用于防抖
  private readonly consoleRegex =
    /console\.(log|warn|error|info|debug|table|dir|trace|group|groupCollapsed|groupEnd|clear|count|countReset|time|timeLog)\s*\(/g;

  constructor(private context: vscode.ExtensionContext) {
    // 监听文本编辑器变化事件，使用防抖处理
    vscode.window.onDidChangeActiveTextEditor(() => {
      if (this.currentMode === "currentFile") {
        this.debouncedRefresh();
      }
    });

    // 监听文档变化事件，使用防抖处理
    vscode.workspace.onDidChangeTextDocument(() => {
      if (this.currentMode === "currentFile") {
        this.debouncedRefresh();
      }
    });

    // 注册打开日志位置的命令
    this.registerOpenLogLocationCommand();
  }

  // 注册打开日志位置的命令
  private registerOpenLogLocationCommand(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        "log-rush.openLogLocation",
        async (fileUri: vscode.Uri, lineNumber: number) => {
          try {
            // 确保fileUri是一个有效的URI对象
            if (!(fileUri instanceof vscode.Uri)) {
              fileUri =
                typeof fileUri === "string"
                  ? vscode.Uri.file(fileUri)
                  : fileUri;
            }

            // 检查文件是否存在
            try {
              await vscode.workspace.fs.stat(fileUri);
            } catch (error) {
              throw new Error(`文件不存在: ${fileUri.fsPath}`);
            }

            // 打开文档
            const document = await vscode.workspace.openTextDocument(fileUri);
            const editor = await vscode.window.showTextDocument(document);

            // 确保行号有效
            const lineCount = document.lineCount;
            if (lineNumber >= 0 && lineNumber < lineCount) {
              // 移动光标到指定行
              const position = new vscode.Position(lineNumber, 0);
              editor.selection = new vscode.Selection(position, position);
              editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
              );
            } else {
              vscode.window.showWarningMessage(`行号无效: ${lineNumber + 1}`);
            }
          } catch (error) {
            vscode.window.showErrorMessage(
              `打开文件失败: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            console.error("打开日志位置时出错:", error);
          }
        }
      )
    );
  }

  // 防抖刷新，避免频繁更新树视图
  private debouncedRefresh(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.refresh();
    }, 300); // 300ms延迟
  }

  // 刷新树视图
  refresh(): void {
    this._onDidChangeTreeData.fire(); // 触发树数据变化事件
  }

  // 切换模式（当前文件/工作区）
  toggleMode(): void {
    this.currentMode =
      this.currentMode === "currentFile" ? "workspace" : "currentFile";
    this.refresh(); // 刷新树视图
  }

  // 获取当前模式
  getCurrentMode(): string {
    return this.currentMode;
  }

  // 获取树项
  getTreeItem(element: LogItem | FileGroup): vscode.TreeItem {
    return element; // 返回树节点对象
  }

  // 获取子节点
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
            // 使用URI进行文件操作
            const fileUri = vscode.Uri.file(filePath);
            fileGroups.push(
              new FileGroup(
                path.basename(filePath), // 文件名作为标签
                vscode.TreeItemCollapsibleState.Collapsed, // 折叠状态
                fileUri, // 文件URI
                items // 子节点列表
              )
            );
          }
        });
        return fileGroups.sort((a, b) => a.label.localeCompare(b.label)); // 返回排序后的文件组列表
      }
    }

    return []; // 其他情况返回空数组
  }

  // 查找所有日志
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

              const totalFiles = files.length;
              let processedFiles = 0;

              // 使用批处理提高性能
              const batchSize = 10;
              for (let i = 0; i < totalFiles; i += batchSize) {
                if (token.isCancellationRequested) break; // 如果用户取消，则终止

                const batch = files.slice(
                  i,
                  Math.min(i + batchSize, totalFiles)
                );
                await Promise.all(
                  batch.map(async (file) => {
                    try {
                      const document = await vscode.workspace.openTextDocument(
                        file
                      );
                      await this.findLogsInFile(document); // 在文件中查找日志
                    } catch (error) {
                      console.error(`处理文件时出错 ${file.fsPath}:`, error);
                    }
                  })
                );

                processedFiles += batch.length;
                progress.report({
                  message: `已处理 ${processedFiles}/${totalFiles} 个文件`,
                  increment: (batch.length / totalFiles) * 100,
                });
              }
            }
          }
        );
      }
    }
  }

  // 在单个文件中查找日志
  private async findLogsInFile(document: vscode.TextDocument): Promise<void> {
    const filePath = document.uri.fsPath; // 获取文件路径
    const fileUri = document.uri; // 获取文件URI
    const fileItems: LogItem[] = []; // 存储文件中的日志项

    const text = document.getText(); // 获取文档全文
    this.consoleRegex.lastIndex = 0; // 重置正则表达式的lastIndex

    let match;
    while ((match = this.consoleRegex.exec(text)) !== null) {
      // 获取整行内容
      const position = document.positionAt(match.index);
      const line = document.lineAt(position.line);
      const fullLine = line.text;
      const logType = match[1] as LogType;

      // 提取变量名或消息内容
      let label = this.extractLogLabel(fullLine, logType);

      fileItems.push(
        new LogItem(
          label, // 标签
          vscode.TreeItemCollapsibleState.None, // 不可折叠
          fileUri, // 文件URI
          position.line, // 行号
          fullLine, // 完整代码行
          logType // 日志类型
        )
      );
    }

    if (fileItems.length > 0) {
      this.logItems.set(filePath, fileItems); // 将文件中的日志项存储到映射中
    }
  }

  // 提取日志标签
  private extractLogLabel(line: string, logType: LogType): string {
    // 尝试提取引号内的内容
    const stringMatch = line.match(/console\.[^(]+\(\s*["'`]([^"'`]+)["'`]/);
    if (stringMatch && stringMatch[1]) {
      let content = stringMatch[1].trim();
      return content.length > 40 ? `${content.substring(0, 37)}...` : content;
    }

    // 尝试提取第二个参数（通常是变量名）
    const argsMatch = line.match(/console\.[^(]+\([^,]*,\s*([^)]+)\)/);
    if (argsMatch && argsMatch[1]) {
      let varName = argsMatch[1].trim();
      return `${logType}: ${
        varName.length > 30 ? varName.substring(0, 27) + "..." : varName
      }`;
    }

    // 默认标签
    return `${logType}`;
  }
}
