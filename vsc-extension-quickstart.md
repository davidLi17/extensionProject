# 欢迎来到你的 VS Code 扩展

## 文件夹中包含的内容

* 该文件夹包含了扩展所需的所有文件。
* `package.json` - 这是声明扩展和命令的清单文件。
  * 示例插件注册了一个命令，并定义了其标题和命令名称。通过这些信息，VS Code 可以在命令面板中显示该命令。此时还不需要加载插件。
* `src/extension.ts` - 这是提供命令实现的主要文件。
  * 该文件导出了一个函数 `activate`，它会在扩展首次被激活时调用（在这个例子中是通过执行命令激活）。在 `activate` 函数内部，我们调用了 `registerCommand`。
  * 我们将包含命令实现的函数作为第二个参数传递给 `registerCommand`。

## 设置

* 安装推荐的扩展（amodio.tsl-problem-matcher、ms-vscode.extension-test-runner 和 dbaeumer.vscode-eslint）。

## 立即开始运行

* 按下 `F5` 打开一个新窗口，加载你的扩展。
* 通过按下 (`Ctrl+Shift+P` 或 Mac 上的 `Cmd+Shift+P`) 并输入 `Hello World`，从命令面板中运行你的命令。
* 在 `src/extension.ts` 中设置断点以调试你的扩展。
* 在调试控制台中查看来自你扩展的输出。

## 修改代码

* 在修改 `src/extension.ts` 中的代码后，可以通过调试工具栏重新启动扩展。
* 你也可以通过 (`Ctrl+R` 或 Mac 上的 `Cmd+R`) 重新加载 VS Code 窗口以加载你的更改。

## 探索 API

* 当你打开文件 `node_modules/@types/vscode/index.d.ts` 时，可以查看我们的完整 API 集合。

## 运行测试

* 安装 [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner)。
* 通过 **任务: 运行任务** 命令运行 "watch" 任务。确保此任务正在运行，否则可能无法发现测试。
* 从活动栏中打开测试视图，点击“运行测试”按钮，或者使用快捷键 `Ctrl/Cmd + ; A`。
* 在测试结果视图中查看测试结果的输出。
* 修改 `src/test/extension.test.ts` 或在 `test` 文件夹中创建新的测试文件。
  * 提供的测试运行器只会考虑匹配命名模式 `**.test.ts` 的文件。
  * 你可以在 `test` 文件夹中创建子文件夹以任意方式组织你的测试。

## 更进一步

* 通过 [打包你的扩展](https://code.visualstudio.com/api/working-with-extensions/bundling-extension) 来减少扩展大小并提高启动速度。
* 在 VS Code 扩展市场上 [发布你的扩展](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)。
* 通过设置 [持续集成](https://code.visualstudio.com/api/working-with-extensions/continuous-integration) 自动化构建过程。