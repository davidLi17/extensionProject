[根目录](../../CLAUDE.md) > [src](../) > **types**

# types 模块

## 模块职责

定义整个扩展的核心数据类型、接口和枚举，为模块间通信提供统一的类型系统。

## 入口与启动

### 文件结构
- `index.ts` - 类型定义的主入口文件

### 导出类型
```typescript
export { LogFormatType, LogType, LogConfig };
```

## 对外接口

### 核心枚举定义

#### LogFormatType - 日志格式类型
```typescript
enum LogFormatType {
  SHORT = "short",    // 简短格式: index.tsx values:::
  FULL = "full",      // 完整格式: src/pages/index.tsx values:::
  CUSTOM = "custom",  // 自定义格式
}
```

#### LogType - 日志级别类型
```typescript
enum LogType {
  LOG = "log",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  DEBUG = "debug",
  TRACE = "trace",
  TABLE = "table",
  GROUP = "group",
  GROUPCOLLAPSED = "groupCollapsed",
  GROUPEND = "groupEnd",
  CLEAR = "clear",
  COUNT = "count",
  COUNTRESET = "countReset",
  TIME = "time",
  TIMEDLOG = "timeLog",
}
```

### 核心接口定义

#### LogConfig - 日志配置接口
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

## 关键依赖与配置

### 依赖关系
- **无外部依赖**: 纯类型定义文件
- **内部引用**: 被其他模块广泛引用

### 配置映射
类型定义与 VSCode 配置的映射关系：
- `log-rush.LogMethod` → `LogConfig.logMethod`
- `log-rush.VarPilotSymbol` → `LogConfig.varPilotSymbol`
- `log-rush.QuotationMark` → `LogConfig.quotationMark`
- `log-rush.ShowLogSemicolon` → `LogConfig.showLogSemicolon`
- `log-rush.ShowLineTag` → `LogConfig.showLineNumber`
- `log-rush.ShowFilePath` → `LogConfig.showFilePath`
- `log-rush.FilePathType` → `LogConfig.filePathType`
- `log-rush.LineTagAtBeginOrEnd` → `LogConfig.lineTagPosition`
- `log-rush.CustomFormat` → `LogConfig.customFormat`

## 数据模型

### 类型层次结构
```
LogConfig (配置对象)
├── 基础设置 (logMethod, varPilotSymbol, quotationMark)
├── 显示设置 (showLogSemicolon, showLineNumber, showFilePath)
├── 格式设置 (filePathType, lineTagPosition, customFormat)
└── 字面量类型 (LogFormatType, LogType)

LogFormatType (枚举)
├── SHORT - 简短格式
├── FULL - 完整格式
└── CUSTOM - 自定义格式

LogType (枚举)
├── 基础日志 (log, info, warn, error, debug, trace)
├── 分组日志 (group, groupCollapsed, groupEnd)
├── 特殊功能 (table, dir, clear, count, countReset)
└── 性能计时 (time, timeLog)
```

## 测试与质量

### 类型安全
- TypeScript 严格模式检查
- 所有接口都有明确的类型注解
- 枚举值与字符串字面量对应

### 扩展性
- 枚举设计便于添加新的日志类型
- 接口结构支持未来功能扩展
- 配置项映射灵活可扩展

## 常见问题 (FAQ)

**Q: 如何添加新的日志类型？**
A: 在 LogType 枚举中添加新的枚举值，并在相应处理逻辑中添加支持。

**Q: 自定义格式的变量有哪些？**
A: 支持的模板变量包括文件信息、上下文信息、变量信息和位置信息等。

**Q: 配置项如何验证？**
A: 通过 VSCode 的配置定义进行验证，类型定义确保运行时类型安全。

**Q: 类型定义是否考虑了国际化？**
A: 目前使用英文枚举值，UI 层面支持中文显示。

## 相关文件清单

| 文件路径 | 文件大小 | 主要功能 |
|----------|----------|----------|
| `index.ts` | 36 行 | 核心类型定义，包含所有枚举和接口 |

### 引用此模块的文件
- `ctrl-key/quickLog.ts` - 使用 LogConfig、LogType
- `utils/logExplorer.ts` - 使用 LogType
- `utils/codeAnalyzer/` - 使用分析相关类型
- `extension.ts` - 间接引用类型

---

## 变更记录 (Changelog)

### 2025-11-26 23:36:24
- 创建 types 模块文档
- 完整记录类型定义和接口
- 分析类型层次结构和依赖关系