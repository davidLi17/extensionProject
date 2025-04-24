# 📊 LogRush

> A powerful VSCode extension for quickly inserting, managing, and cleaning up console log statements.

[English](#english-guide) | [Chinese](#chineseGuide)


<a name="english-guide"></a>
## English Guide

### 📋 Table of Contents
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Examples](#examples)
- [Development](#development)

<a name="features"></a>
### 🚀 Features

#### Quick Log Insertion
- Supports multiple log types:
  - `console.log` - Normal logs
  - `console.error` - Error logs
- Smart variable logging: Automatically generates log statements with variable names when a variable is selected
- Customizable log format: Supports filename, line number, custom delimiters, and more
- Supports JavaScript and TypeScript files

#### Log Management
- Remove all console statements with one click
- Batch comment/uncomment console statements
- Supports log management for selected areas or the entire file

#### Log Explorer & Navigation
- View all console statements in the sidebar explorer
- Navigate between logs with keyboard shortcuts
- Filter logs by current file or entire workspace
- Highlight console statements for better visibility
- Jump to any log statement with a single click

<a name="installation"></a>
### 📥 Installation

Search for "LogRush" in the VSCode extension marketplace and install it.

<a name="usage"></a>
### 💻 Usage

#### Keyboard Shortcuts
- Insert `console.log`: `Ctrl+1` (Mac: `Cmd+1`)
- Insert `console.error`: `Ctrl+2` (Mac: `Cmd+2`)
- Comment all console statements: `Ctrl+F2` (Mac: `Cmd+F2`)

#### Log Navigation
- Toggle log highlighting: `Ctrl+Shift+H` (Mac: `Cmd+Shift+H`)
- Go to next log: `Alt+N`
- Go to previous log: `Alt+P`

#### Log Explorer
- Click on the LogRush icon in the activity bar to open the Log Explorer
- Toggle between "Current File" and "Workspace" modes using the icon in the view header
- Click on any log item to navigate directly to it
- Use the refresh button to update the log list


<a name="configuration"></a>
### ⚙️ Configuration

You can customize the following options in VSCode settings:

#### Basic Settings
- `logrush.LogMethod`: Set the default log method (default: "console.log")
- `logrush.VarPilotSymbol`: Set the variable delimiter (default: "::")
- `logrush.QuotationMark`: Set the quote type ("single" or "double", default: "double")
- `logrush.ShowLogSemicolon`: Whether to add a semicolon at the end of the log (default: true)

#### Display Settings
- `logrush.ShowLineTag`: Whether to display the line number (default: true)
- `logrush.LineTagAtBeginOrEnd`: Where to display the line number ("begin" or "end", default: "begin")
- `logrush.ShowFilePath`: Whether to display the file path (default: true)
- `logrush.FilePathType`: File path display type (default: "short")
  - "short": Only display the file name
  - "full": Display the relative path
  - "custom": Custom format
- `logrush.EnableHighlight`: Whether to enable log highlighting (default: true)
- `logrush.HighlightColor`: Background color for log highlights (default: "rgba(255, 215, 0, 0.2)")
- `logrush.HighlightBorderColor`: Border color for log highlights (default: "rgba(255, 215, 0, 0.6)")

#### Custom Format
Recommended configuration: `[Custom name]:${filePath} ${varName}:::`

- `logrush.CustomFormat`: Custom log format (default: "${fileName} ${varName}::: "), supporting the following variables:
  - `${fileName}`: File name (example: config.tsx)
  - `${filePath}`: Relative path (example: src/config.tsx)
  - `${fullPath}`: Full path (example: /Users/username/project/src/config.tsx)
  - `${varName}`: Variable name (example: columns)
  - `${lineNumber}`: Line number (example: line:10)

<a name="examples"></a>
### 📝 Examples

#### Basic Usage
1. Select a variable
2. Use a shortcut or command to insert a log
3. Automatically generate a formatted log statement on the next line

#### Log Format Examples
```javascript
// Default format
console.log("index.js myVariable::", myVariable);

// With line number
console.log("line:10 index.js myVariable::", myVariable);

// Custom format
console.log("[DEBUG][index.js:10] myVariable::", myVariable);
```

<a name="development"></a>
### 🛠️ Development

#### Project Structure
```
src/
  ├── ctrl-key/
  │   ├── quickLog.ts      # Log insertion functionality
  │   └── quickRemoveLog.ts # Log management functionality
  ├── types/
  │   └── index.ts         # Type definitions
  ├── utils/
  │   ├── logExplorer.ts   # Log explorer sidebar functionality
  │   ├── logHighlighter.ts # Log highlighting and navigation
  │   └── index.ts         # Helper utilities
  └── extension.ts         # Extension entry point
```

#### Build and Test
1. Clone the repository
2. Run `npm install` to install dependencies
3. Press F5 to start a debugging instance

#### Contribution
Welcome to submit Issues and Pull Requests!

#### License
MIT

🔝 Back to Top

---

<a name="chineseGuide"></a>
## 中文指南

### 📋 目录
- 功能特性
- 安装
- 使用方法
- 配置选项
- 示例
- 开发

<a name="功能特性"></a>
### 🚀 功能特性

#### 快速插入日志
- 支持多种日志类型：
  - `console.log` - 普通日志
  - `console.error` - 错误日志
- 智能变量日志：选中变量后自动生成带变量名的日志语句
- 自定义日志格式：支持文件名、行号、自定义分隔符等多种格式选项
- 支持 JavaScript 和 TypeScript 文件

#### 日志管理
- 一键移除所有 console 语句
- 批量注释/取消注释 console 语句
- 支持选中区域或整个文件的日志管理

#### 日志浏览器与导航
- 在侧边栏中查看所有 console 语句
- 使用快捷键在日志语句间快速导航
- 可按当前文件或整个工作区筛选日志
- 高亮显示 console 语句以提高可见性
- 单击即可跳转到任意日志语句

<a name="安装"></a>
### 📥 安装

在 VSCode 扩展商店中搜索 "LogRush" 并安装。

<a name="使用方法"></a>
### 💻 使用方法

#### 快捷键
- 插入 console.log: `Ctrl+1` (Mac: `Cmd+1`)
- 插入 console.error: `Ctrl+2` (Mac: `Cmd+2`)
- 注释所有 console 语句: `Ctrl+F1` (Mac: `Cmd+F1`)
- 取消注释所有 console 语句: `Ctrl+F2` (Mac: `Cmd+F2`)
- 移除所有 console 语句: `Ctrl+F3` (Mac: `Cmd+F3`)

#### 日志导航
- 切换日志高亮: `Ctrl+Shift+H` (Mac: `Cmd+Shift+H`) [H=>Highlight]
- 下一个日志: `Alt+N` [N=>Next]
- 上一个日志: `Alt+P` [P=>Previous]

#### 日志浏览器
- 点击活动栏中的 LogRush 图标打开日志浏览器
- 使用视图标题栏中的图标在"当前文件"和"工作区"模式之间切换
- 点击任意日志项可直接导航至对应位置
- 使用刷新按钮更新日志列表

#### 自定义格式
推荐配置为: `[自定义名称]:${filePath} ${varName}:::`

- `logrush.CustomFormat`: 自定义日志格式（默认："${fileName} ${varName}::: "），支持以下变量：
  - `${fileName}`: 文件名（示例：config.tsx）
  - `${filePath}`: 相对路径（示例：src/config.tsx）
  - `${fullPath}`: 完整路径（示例：/Users/username/project/src/config.tsx）
  - `${varName}`: 变量名（示例：columns）
  - `${lineNumber}`: 行号（示例：line:10）

<a name="示例"></a>
### 📝 示例

#### 基本使用
1. 选中变量
2. 使用快捷键或命令插入日志
3. 自动在下一行生成格式化的日志语句

#### 日志格式示例
```javascript
// 默认格式
console.log("index.js myVariable::", myVariable);

// 带行号
console.log("line:10 index.js myVariable::", myVariable);

// 自定义格式
console.log("[DEBUG][index.js:10] myVariable::", myVariable);
```
<a name="配置选项"></a>
### ⚙️ 配置选项

在 VSCode 设置中可以自定义以下选项：

#### 基本设置
- `logrush.LogMethod`: 设置默认的日志方法（默认："console.log"）
- `logrush.VarPilotSymbol`: 设置变量分隔符（默认："::"）
- `logrush.QuotationMark`: 设置引号类型（"single" 或 "double"，默认："double"）
- `logrush.ShowLogSemicolon`: 是否在日志末尾添加分号（默认：true）

#### 显示设置
- `logrush.ShowLineTag`: 是否显示行号（默认：true）
- `logrush.LineTagAtBeginOrEnd`: 行号显示位置（"begin" 或 "end"，默认："begin"）
- `logrush.ShowFilePath`: 是否显示文件路径（默认：true）
- `logrush.FilePathType`: 文件路径显示类型（默认："short"）
  - "short": 仅显示文件名
  - "full": 显示相对路径
  - "custom": 自定义格式
- `logrush.EnableHighlight`: 是否启用日志高亮显示（默认：true）
- `logrush.HighlightColor`: 日志高亮的背景颜色（默认："rgba(255, 215, 0, 0.2)"）
- `logrush.HighlightBorderColor`: 日志高亮的边框颜色（默认："rgba(255, 215, 0, 0.6)"）

<a name="开发"></a>
### 🛠️ 开发

#### 项目结构
```
src/
  ├── ctrl-key/
  │   ├── quickLog.ts      # 日志插入功能
  │   └── quickRemoveLog.ts # 日志管理功能
  ├── types/
  │   └── index.ts         # 类型定义
  ├── utils/
  │   ├── logExplorer.ts   # 日志浏览器侧边栏功能
  │   ├── logHighlighter.ts # 日志高亮和导航功能
  │   └── index.ts         # 辅助工具
  └── extension.ts         # 扩展入口
```

#### 构建和测试
1. 克隆仓库
2. 运行 `npm install` 安装依赖
3. 按 F5 启动调试实例

#### 贡献
欢迎提交 Issue 和 Pull Request！

#### 许可证
MIT

🔝 返回顶部
