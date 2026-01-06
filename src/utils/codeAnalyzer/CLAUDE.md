[根目录](../../../CLAUDE.md) > [src](../../) > [utils](../) > **codeAnalyzer**

# codeAnalyzer 模块

## 模块职责

负责 JavaScript/TypeScript 代码的静态分析，提供 AST 解析、作用域管理、变量查找和插入点计算等核心功能。

## 入口与启动

### 主入口文件
- `index.ts` - 模块主入口，导出核心分析函数

### 初始化流程
1. 扩展激活时自动初始化 AstCache 和 Logger
2. 首次使用时创建 AST 解析器和作用域分析器

### 核心函数导出
```typescript
// 插入点计算
export function findValidInsertionPoint(...): InsertionPosition | null

// 上下文分析
export function getEnclosingContextName(...): ContextInfo

// 调试分析器
export function debugCodeAnalysis(...)
export function debugObjectMethodAnalysis(...)
```

## 对外接口

### 插入点计算
```typescript
function findValidInsertionPoint(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  variableName: string
): InsertionPosition | null
```

### 上下文信息获取
```typescript
function getEnclosingContextName(
  document: vscode.TextDocument,
  position: vscode.Position
): ContextInfo
```

### 调试功能
```typescript
function debugCodeAnalysis(
  document: vscode.TextDocument,
  position: vscode.Position,
  word: string
): void

function debugObjectMethodAnalysis(
  document: vscode.TextDocument,
  position: vscode.Position,
  word: string
): void
```

## 关键依赖与配置

### 外部依赖
- **@babel/parser**: JavaScript/TypeScript 解析器
- **@babel/traverse**: AST 遍历工具
- **@babel/types**: AST 节点类型定义
- **vscode**: VSCode 扩展 API

### 内部模块依赖
- **vscode**: 文档和位置相关类型
- **types/index**: 共享类型定义

### 模块间依赖关系
```
core/ (核心模块)
├── astCache.ts → 提供缓存功能给其他模块
├── parser.ts → 被 astCache 和分析器使用
└── logger.ts → 被所有模块使用进行调试

analyzers/ (分析器模块)
├── contextAnalyzer.ts → 使用 core/parser
├── scopeAnalyzer.ts → 使用 core/parser 和 astCache
├── pathAnalyzer.ts → 使用 core/parser
└── debugAnalyzer.ts → 使用所有分析器

utils/helpers.ts → 辅助函数
```

## 数据模型

### 核心类型定义

#### InsertionPosition - 插入位置信息
```typescript
interface InsertionPosition {
  line: number;           // 行号
  character: number;      // 列号
  isEndOfStatement: boolean; // 是否在语句末尾
  scopeInfo?: ScopeInfo;  // 作用域信息
}
```

#### ContextInfo - 上下文信息
```typescript
interface ContextInfo {
  functionName?: string;  // 函数名
  objectName?: string;    // 对象名
  scopeType: string;     // 作用域类型
  filePath: string;      // 文件路径
}
```

#### ScopeInfo - 作用域信息
```typescript
interface ScopeInfo {
  type: string;           // 作用域类型
  start: number;          // 开始位置
  end: number;            // 结束位置
  variableMap?: Map<string, VariableInfo>; // 变量映射
  parent?: ScopeInfo;     // 父作用域
}
```

#### VariableInfo - 变量信息
```typescript
interface VariableInfo {
  name: string;           // 变量名
  type: string;           // 变量类型
  declaredAt: number;     // 声明位置
  isAvailable: boolean;   // 是否可用
}
```

### AST 节点处理
基于 Babel AST 的节点类型处理：
- `FunctionDeclaration` - 函数声明
- `ArrowFunctionExpression` - 箭头函数
- `ClassDeclaration` - 类声明
- `MethodDefinition` - 方法定义
- `VariableDeclaration` - 变量声明
- `BlockStatement` - 代码块

## 测试与质量

### 性能优化
- **AST 缓存**: AstCache 模块缓存解析结果，避免重复解析
- **增量更新**: 只在文件变化时重新解析
- **内存管理**: 定期清理不用的缓存项

### 错误处理
- **解析错误**: 容错处理语法错误，提供基本分析
- **类型检查**: 严格的 TypeScript 类型检查
- **边界情况**: 处理空文件、超大文件等情况

### 调试支持
- **详细日志**: Logger 模块提供分级调试日志
- **可视化分析**: debugAnalyzer 提供分析结果可视化
- **性能监控**: 记录解析和分析耗时

## 常见问题 (FAQ)

**Q: 代码分析支持哪些 JavaScript/TypeScript 特性？**
A: 基于 Babel 解析器，支持现代 ES6+、TypeScript、JSX 等特性。

**Q: 大文件分析会影响性能吗？**
A: 使用了缓存机制和增量解析，对大文件也有较好性能。

**Q: 如何扩展分析器功能？**
A: 可以在 analyzers/ 目录下添加新的分析器模块，实现特定需求。

**Q: AST 解析失败时如何处理？**
A: 有错误容错机制，即使解析失败也能提供基本的位置信息。

**Q: 作用域分析的准确度如何？**
A: 基于完整的 AST 遍历，能够准确识别变量作用域和生命周期。

## 相关文件清单

### 核心模块
| 文件路径 | 文件大小 | 主要功能 |
|----------|----------|----------|
| `index.ts` | ~50+ 行 | 主入口，导出核心分析函数 |
| `types/index.ts` | 待分析 | 分析器专用类型定义 |

### 核心工具 (core/)
| 文件路径 | 主要功能 |
|----------|----------|
| `astCache.ts` | AST 解析结果缓存，性能优化 |
| `parser.ts` | Babel 解析器封装，错误处理 |
| `logger.ts` | 分级日志系统，调试支持 |

### 分析器模块 (analyzers/)
| 文件路径 | 主要功能 |
|----------|----------|
| `contextAnalyzer.ts` | 上下文分析（函数、类、对象） |
| `scopeAnalyzer.ts` | 作用域分析（变量、生命周期） |
| `pathAnalyzer.ts` | 路径和位置分析 |
| `debugAnalyzer.ts` | 调试和可视化功能 |

### 工具模块
| 文件路径 | 主要功能 |
|----------|----------|
| `utils/helpers.ts` | 辅助工具函数 |

---

## 变更记录 (Changelog)

### 2025-11-26 23:36:24
- 创建 codeAnalyzer 模块文档
- 分析模块结构和核心功能
- 定义数据模型和接口
- 记录模块间依赖关系