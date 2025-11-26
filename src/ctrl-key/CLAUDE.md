[根目录](../../CLAUDE.md) > [src](../) > **ctrl-key**

# ctrl-key 模块

## 模块职责

负责处理所有快捷键操作和日志相关的用户交互，包括日志插入、批量管理等功能。

## 入口与启动

### quickLog.ts
- **主要函数**: `insertConsoleLog(logType: LogType)`
- **支持的日志类型**: log, error, warn, info, debug, trace, table 等
- **入口点**: 通过 VSCode 命令注册激活
  - `log-rush.qlog` → 快速插入 console.log
  - `log-rush.qerror` → 快速插入 console.error
  - `log-rush.qwarn` → 快速插入 console.warn
  - `log-rush.qinfo` → 快速插入 console.info

### quickRemoveLog.ts
- **主要功能**: 日志的批量操作
- **支持的命令**:
  - `log-rush.removeLog` → 移除所有 console 语句
  - `log-rush.commentLog` → 注释所有 console 语句
  - `log-rush.uncommentLog` → 取消注释所有 console 语句

## 对外接口

### 配置接口
```typescript
interface LogConfig {
  logMethod: string;           // 日志方法，默认 "console.log"
  varPilotSymbol: string;      // 变量标识符，默认 "::"
  quotationMark: string;       // 引号类型，单引号或双引号
  showLogSemicolon: boolean;   // 是否显示分号
  showLineNumber: boolean;     // 是否显示行号
  showFilePath: boolean;       // 是否显示文件路径
  filePathType: LogFormatType; // 路径格式类型
  lineTagPosition: "begin" | "end"; // 行号位置
  customFormat: string;        // 自定义格式模板
}
```

### 快捷键绑定
- `Ctrl+1` (Mac: `Cmd+1`) → 插入 console.log
- `Ctrl+2` (Mac: `Cmd+2`) → 插入 console.error
- `Ctrl+F1` (Mac: `Cmd+F1`) → 注释所有 console 语句
- `Ctrl+F2` (Mac: `Cmd+F2`) → 取消注释所有 console 语句
- `Ctrl+F3` (Mac: `Cmd+F3`) → 移除所有 console 语句

## 关键依赖与配置

### 外部依赖
- **vscode**: VSCode 扩展 API
- **@babel/traverse**: AST 遍历和分析
- **@babel/types**: AST 节点类型定义
- **path**: Node.js 路径处理

### 内部模块依赖
- **utils/codeAnalyzer**: 代码分析和作用域管理
- **utils/logHighlighter**: 日志高亮功能
- **types/index**: 类型定义

### 配置系统
通过 VSCode 工作区配置进行个性化设置：
- `log-rush.*` 系列配置项
- 支持用户自定义日志格式
- 灵活的显示选项控制

## 数据模型

### 日志类型枚举
```typescript
enum LogType {
  LOG = "log",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  DEBUG = "debug",
  TRACE = "trace",
  TABLE = "table",
  // ... 其他类型
}
```

### 格式化模板变量
- `${fileName}`: 文件名
- `${filePath}`: 相对路径
- `${fullPath}`: 完整路径
- `${functionName}`: 函数名
- `${objectName}`: 对象名
- `${contextPath}`: 上下文路径
- `${varName}`: 变量名
- `${lineNumber}`: 行号
- `${varPilotSymbol}`: 变量标识符

## 测试与质量

### 单元测试覆盖
- 日志语句生成逻辑测试
- 配置解析和格式化测试
- 变量检测和插入点计算测试

### 边界情况处理
- 空选择和变量选择的差异化处理
- 不同代码结构的插入点计算
- 特殊字符和转义处理

## 常见问题 (FAQ)

**Q: 如何自定义日志格式？**
A: 在 VSCode 设置中配置 `log-rush.CustomFormat`，支持多种模板变量。

**Q: 插入点是如何确定的？**
A: 通过代码分析模块对 AST 进行解析，找到合适的作用域和位置。

**Q: 支持哪些编程语言？**
A: 主要支持 JavaScript 和 TypeScript，基于 Babel 解析器。

**Q: 批量操作会影响性能吗？**
A: 使用了优化的文件扫描和 AST 分析，对大文件也有较好的性能。

## 相关文件清单

| 文件路径 | 文件大小 | 主要功能 |
|----------|----------|----------|
| `quickLog.ts` | ~390 行 | 日志插入功能，支持多种格式和快捷键 |
| `quickRemoveLog.ts` | 待分析 | 日志批量管理功能 |

---

## 变更记录 (Changelog)

### 2025-11-26 23:36:24
- 创建 ctrl-key 模块文档
- 分析 quickLog.ts 的核心功能
- 定义模块接口和数据模型