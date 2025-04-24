import * as path from "path";
import * as assert from "assert";
import * as vscode from "vscode";
import * as sinon from "sinon";
import { LogItem, FileGroup, LogExplorerProvider } from "@/utils/logExplorer";
import { LogType } from "@/utils/logExplorer";
// 为 VS Code API 创建模拟对象
class MockUri {
  readonly fsPath: string;

  constructor(fsPath: string) {
    this.fsPath = fsPath;
  }

  static file(path: string): MockUri {
    return new MockUri(path);
  }
}

function normalizePath(inputPath: string): string {
  return inputPath.replace(/\\/g, "/");
}
function getFileInfo(document: vscode.TextDocument) {
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
(() => {
  const mockDocument = {
    fileName: "C:\\project\\src\\file.ts",
  } as vscode.TextDocument;

  const result = getFileInfo(mockDocument);

  assert.strictEqual(
    result.fileName,
    "file.ts",
    "Test Case 1: fileName should be file.ts"
  );
  assert.strictEqual(
    result.fileDir,
    "C:/project/src",
    "Test Case 1: fileDir should be C:/project/src"
  );
  assert.strictEqual(
    result.relativePath,
    "src/file.ts",
    "Test Case 1: relativePath should be src/file.ts"
  );

  console.log("Test Case 1 Passed!"); // 可选的成功提示
})();
// 测试用例 2: 文件名中包含多个点
(() => {
  const mockDocument = {
    fileName: "C:\\project\\src\\file.config.ts",
  } as vscode.TextDocument;

  const result = getFileInfo(mockDocument);

  assert.strictEqual(
    result.fileName,
    "file.config.ts",
    "Test Case 2: fileName should be file.config.ts"
  );
  assert.strictEqual(
    result.fileDir,
    "C:/project/src",
    "Test Case 2: fileDir should be C:/project/src"
  );
  assert.strictEqual(
    result.relativePath,
    "src/file.config.ts",
    "Test Case 2: relativePath should be src/file.config.ts"
  );

  console.log("Test Case 2 Passed!"); // 可选的成功提示
})();

// 模拟测试环境
suite("LogExplorer 测试套件", () => {
  // 测试前的准备工作
  setup(() => {
    // 可以在这里添加测试前的准备工作
  });

  // 测试后的清理工作
  teardown(() => {
    // 可以在这里添加测试后的清理工作
  });

  test("LogItem 类应该正确创建并设置属性", () => {
    // 模拟 vscode.Uri
    const mockUri = MockUri.file("/path/to/file.js");

    // 创建 LogItem 实例
    const logItem = new LogItem(
      "Test log message",
      vscode.TreeItemCollapsibleState.None,
      mockUri as unknown as vscode.Uri,
      10,
      'console.log("Test log message");',
      LogType.Log // 使用字符串而不是枚举，避免导入问题
    );

    // 验证属性
    assert.strictEqual(logItem.label, "Test log message");
    assert.strictEqual(
      logItem.collapsibleState,
      vscode.TreeItemCollapsibleState.None
    );
    assert.strictEqual(logItem.fileUri, mockUri);
    assert.strictEqual(logItem.lineNumber, 10);
    assert.strictEqual(logItem.fullLine, 'console.log("Test log message");');
    assert.strictEqual(logItem.tooltip, 'console.log("Test log message");');
    assert.strictEqual(logItem.description, "file.js:11"); // 注意行号+1
    assert.strictEqual(logItem.contextValue, "logItem.log");

    // 验证命令
    assert.strictEqual(logItem.command?.command, "log-rush.openLogLocation");
    assert.strictEqual(logItem.command?.title, "打开日志位置");
    assert.deepStrictEqual(logItem.command?.arguments, [mockUri, 10]);
  });

  test("FileGroup 类应该正确创建并设置属性", () => {
    // 模拟 vscode.Uri
    const mockUri = MockUri.file("/path/to/file.js");

    // 创建一些 LogItem 实例
    const logItem1 = new LogItem(
      "Log 1",
      vscode.TreeItemCollapsibleState.None,
      mockUri as unknown as vscode.Uri,
      5,
      'console.log("Log 1");',
      LogType.Log
    );

    const logItem2 = new LogItem(
      "Log 2",
      vscode.TreeItemCollapsibleState.None,
      mockUri as unknown as vscode.Uri,
      10,
      'console.error("Log 2");',
      LogType.Error
    );

    // 创建 FileGroup 实例
    const fileGroup = new FileGroup(
      "file.js",
      vscode.TreeItemCollapsibleState.Collapsed,
      mockUri as unknown as vscode.Uri,
      [logItem1, logItem2]
    );

    // 验证属性
    assert.strictEqual(fileGroup.label, "file.js");
    assert.strictEqual(
      fileGroup.collapsibleState,
      vscode.TreeItemCollapsibleState.Collapsed
    );
    assert.strictEqual(fileGroup.fileUri, mockUri);
    assert.deepStrictEqual(fileGroup.children, [logItem1, logItem2]);
    assert.strictEqual(fileGroup.description, "(2)"); // 两个子节点
    assert.strictEqual(fileGroup.tooltip, "/path/to/file.js");
    assert.strictEqual(fileGroup.contextValue, "fileGroup");
  });

  test("extractLogLabel 方法应该提取引号中的内容", () => {
    // 使用反射访问私有方法
    // 为了测试私有方法，我们创建一个临时的 LogExplorerProvider 实例
    const mockContext = {
      subscriptions: [],
    };
    const provider = new LogExplorerProvider(
      mockContext as unknown as vscode.ExtensionContext
    );

    // @ts-ignore - 使用反射访问私有方法
    const extractLabel = provider["extractLogLabel"].bind(provider);

    // 测试引号中的内容提取
    const result1 = extractLabel('console.log("Hello world");', LogType.Log);
    assert.strictEqual(result1, "Hello world");

    // 测试单引号
    const result2 = extractLabel("console.log('Single quotes');", LogType.Log);
    assert.strictEqual(result2, "Single quotes");

    // 测试反引号
    const result3 = extractLabel(
      "console.log(`Template literal`);",
      LogType.Log
    );
    assert.strictEqual(result3, "Template literal");

    // 测试长文本截断
    const longText = "A".repeat(50);
    const result4 = extractLabel(`console.log("${longText}");`, LogType.Log);
    assert.strictEqual(result4, "A".repeat(37) + "...");

    // 测试变量提取（第二个参数）
    const result5 = extractLabel(
      'console.log("Debug:", variableName);',
      LogType.Log
    );
    assert.strictEqual(result5, "Debug:");

    // 只有变量作为参数的情况
    const result6 = extractLabel("console.log(variableName);", LogType.Log);
    assert.strictEqual(result6, "log");
  });

  test("toggleMode 方法应该切换模式", () => {
    // 创建 LogExplorerProvider 实例
    const mockContext = {
      subscriptions: [],
    };
    const provider = new LogExplorerProvider(
      mockContext as unknown as vscode.ExtensionContext
    );

    // 初始模式应该是 'currentFile'
    assert.strictEqual(provider.getCurrentMode(), "currentFile");

    // 切换模式
    provider.toggleMode();
    assert.strictEqual(provider.getCurrentMode(), "workspace");

    // 再次切换模式
    provider.toggleMode();
    assert.strictEqual(provider.getCurrentMode(), "currentFile");
  });

  test("registerOpenLogLocationCommand 方法应该正确注册命令", () => {
    // 模拟 vscode.commands.registerCommand
    const registerCommandStub = sinon.stub().returns({
      dispose: sinon.stub(),
    });
    const vscodeMock = {
      commands: {
        registerCommand: registerCommandStub,
      },
      Uri: {
        file: MockUri.file,
      },
      workspace: {
        fs: {
          stat: sinon.stub().resolves(),
        },
        openTextDocument: sinon.stub().resolves({
          lineCount: 100,
        }),
      },
      window: {
        showTextDocument: sinon.stub().resolves({
          selection: null,
          revealRange: sinon.stub(),
        }),
        showErrorMessage: sinon.stub(),
        showWarningMessage: sinon.stub(),
      },
      Position: class {},
      Selection: class {},
      Range: class {},
      TextEditorRevealType: {
        InCenter: "InCenter",
      },
    };

    // 使用模拟的 vscode API 创建 LogExplorerProvider
    const mockContext = {
      subscriptions: [],
    };

    // @ts-ignore - 替换全局 vscode
    global.vscode = vscodeMock;

    const provider = new LogExplorerProvider(
      mockContext as unknown as vscode.ExtensionContext
    );

    // 验证命令是否已注册
    assert.strictEqual(registerCommandStub.calledOnce, true);
    assert.strictEqual(
      registerCommandStub.firstCall.args[0],
      "log-rush.openLogLocation"
    );

    // 恢复原始的 vscode 对象
    delete (global as any).vscode;
  });
});
