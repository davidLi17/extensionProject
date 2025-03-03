<!-- EN: Start of English section -->
## Navigation

- [Go to English Section](#en-section)
- [中文部分](#zh-section)

<a name="en-section"></a>
# Quick Console Logger

A powerful VSCode extension for quickly inserting, managing, and cleaning up console log statements.

## Features

### Quick Log Insertion
- Supports multiple log types:
  - `console.log` - Normal logs
  - `console.info` - Information logs
  - `console.warn` - Warning logs
  - `console.error` - Error logs
- Smart variable logging: Automatically generates log statements with variable names when a variable is selected.
- Customizable log format: Supports various format options such as filename, line number, custom delimiters, etc.
- Supports JavaScript and TypeScript files.

### Log Management
- Remove all console statements with one click.
- Batch comment/uncomment console statements.
- Supports log management for selected areas or the entire file.

## Installation

Search for "Quick Console Logger" in the VSCode extension marketplace and install it.

## Usage

### Keyboard Shortcuts
- Insert `console.log`: `Ctrl+1` (Mac: `Cmd+1`)
- Insert `console.error`: `Ctrl+2` (Mac: `Cmd+2`)
- Comment all console statements: `Ctrl+F2` (Mac: `Cmd+F2`)

### Command Palette
Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac) to open the command palette, and you can use the following commands:
- `Quick Console Logger: Insert console.log`
- `Quick Console Logger: Insert console.error`
- `Quick Console Logger: Insert console.warn`
- `Quick Console Logger: Insert console.info`
- `Quick Console Logger: Remove Console Logs`
- `Quick Console Logger: Comment Console Logs`
- `Quick Console Logger: Uncomment Console Logs`

## Configuration Options

You can customize the following options in VSCode settings:

### Basic Settings
- `quick-console-logger.LogMethod`: Set the default log method (default: "console.log").
- `quick-console-logger.VarPilotSymbol`: Set the variable delimiter (default: "::").
- `quick-console-logger.QuotationMark`: Set the quote type ("single" or "double", default: "double").
- `quick-console-logger.ShowLogSemicolon`: Whether to add a semicolon at the end of the log (default: true).

### Display Settings
- `quick-console-logger.ShowLineTag`: Whether to display the line number (default: true).
- `quick-console-logger.LineTagAtBeginOrEnd`: Where to display the line number ("begin" or "end", default: "begin").
- `quick-console-logger.ShowFilePath`: Whether to display the file path (default: true).
- `quick-console-logger.FilePathType`: File path display type (default: "short").
  - "short": Only display the file name.
  - "full": Display the relative path.
  - "custom": Custom format.

### Custom Format
- `quick-console-logger.CustomFormat`: Custom log format (default: "${fileName} ${varName}::: "), supporting the following variables:
  - `${fileName}`: File name
  - `${filePath}`: Relative path
  - `${fullPath}`: Full path
  - `${varName}`: Variable name
  - `${lineNumber}`: Line number

## Examples

### Basic Usage
1. Select a variable.
2. Use a shortcut or command to insert a log.
3. Automatically generate a formatted log statement on the next line.

### Log Format Examples
```javascript
// Default format
console.log("index.js myVariable::", myVariable);

// With line number
console.log("line:10 index.js myVariable::", myVariable);

// Custom format
console.log("[DEBUG][index.js:10] myVariable::", myVariable);
```

## Development

### Project Structure
```
src/
  ├── ctrl-key/
  │   ├── quickLog.ts      # Log insertion functionality
  │   └── quickRemoveLog.ts # Log management functionality
  ├── types/
  │   └── index.ts         # Type definitions
  └── extension.ts         # Extension entry point
```

### Build and Test
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Press F5 to start a debugging instance.

## Contribution

Welcome to submit Issues and Pull Requests!

## License

MIT
<!-- EN: End of English section -->

<!-- ZH: Start of Chinese section -->
<a name="zh-section"></a>

# Quick Console Logger (快速控制台日志)

一个强大的 VSCode 扩展，用于快速插入、管理和清理控制台日志语句。

## 功能特性

### 快速插入日志
- 支持多种日志类型：
  - `console.log` - 普通日志
  - `console.info` - 信息日志
  - `console.warn` - 警告日志
  - `console.error` - 错误日志
- 智能变量日志：选中变量后自动生成带变量名的日志语句
- 自定义日志格式：支持文件名、行号、自定义分隔符等多种格式选项
- 支持 JavaScript 和 TypeScript 文件

### 日志管理
- 一键移除所有 console 语句
- 批量注释/取消注释 console 语句
- 支持选中区域或整个文件的日志管理

## 安装

在 VSCode 扩展商店中搜索 "Quick Console Logger" 并安装。

## 使用方法

### 快捷键
- 插入 console.log: `Ctrl+1` (Mac: `Cmd+1`)
- 插入 console.error: `Ctrl+2` (Mac: `Cmd+2`)
- 注释所有 console 语句: `Ctrl+F2` (Mac: `Cmd+F2`)

### 命令面板
按 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac) 打开命令面板，可以使用以下命令：
- `Quick Console Logger: Insert console.log` (插入 console.log)
- `Quick Console Logger: Insert console.error` (插入 console.error)
- `Quick Console Logger: Insert console.warn` (插入 console.warn)
- `Quick Console Logger: Insert console.info` (插入 console.info)
- `Quick Console Logger: Remove Console Logs` (移除 Console 日志)
- `Quick Console Logger: Comment Console Logs` (注释 Console 日志)
- `Quick Console Logger: Uncomment Console Logs` (取消注释 Console 日志)

## 配置选项

在 VSCode 设置中可以自定义以下选项：

### 基本设置
- `quick-console-logger.LogMethod`: 设置默认的日志方法（默认："console.log"）
- `quick-console-logger.VarPilotSymbol`: 设置变量分隔符（默认："::"）
- `quick-console-logger.QuotationMark`: 设置引号类型（"single" 或 "double"，默认："double"）
- `quick-console-logger.ShowLogSemicolon`: 是否在日志末尾添加分号（默认：true）

### 显示设置
- `quick-console-logger.ShowLineTag`: 是否显示行号（默认：true）
- `quick-console-logger.LineTagAtBeginOrEnd`: 行号显示位置（"begin" 或 "end"，默认："begin"）
- `quick-console-logger.ShowFilePath`: 是否显示文件路径（默认：true）
- `quick-console-logger.FilePathType`: 文件路径显示类型（默认："short"）
  - "short": 仅显示文件名
  - "full": 显示相对路径
  - "custom": 自定义格式

### 自定义格式
- `quick-console-logger.CustomFormat`: 自定义日志格式（默认："${fileName} ${varName}::: "），支持以下变量：
  - `${fileName}`: 文件名
  - `${filePath}`: 相对路径
  - `${fullPath}`: 完整路径
  - `${varName}`: 变量名
  - `${lineNumber}`: 行号

## 示例

### 基本使用
1. 选中变量
2. 使用快捷键或命令插入日志
3. 自动在下一行生成格式化的日志语句

### 日志格式示例
```javascript
// 默认格式
console.log("index.js myVariable::", myVariable);

// 带行号
console.log("line:10 index.js myVariable::", myVariable);

// 自定义格式
console.log("[DEBUG][index.js:10] myVariable::", myVariable);
```

## 开发

### 项目结构
```
src/
  ├── ctrl-key/
  │   ├── quickLog.ts      # 日志插入功能
  │   └── quickRemoveLog.ts # 日志管理功能
  ├── types/
  │   └── index.ts         # 类型定义
  └── extension.ts         # 扩展入口
```

### 构建和测试
1. 克隆仓库
2. 运行 `npm install` 安装依赖
3. 按 F5 启动调试实例

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT
<!-- ZH: End of Chinese section -->
