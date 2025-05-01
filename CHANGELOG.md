# Change Log

All notable changes to the "log-rush" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.2.1] - 2025-04-26


### Changed
- **日志插入算法优化**: 改进日志插入位置的智能分析，更符合编码习惯

## [1.2.0] - 2025-04-25

### Added
- **Babel AST 分析**：新增代码分析功能，支持解析上下文函数名和对象名，优化日志插入逻辑。
- **日志插入点优化**：支持在语句末尾或函数体内智能插入日志。

### Changed
- **日志导航快捷键优化**：MacOS 用户可通过 `Cmd+[` 和 `Cmd+]` 快捷键在日志间跳转。
- **日志格式改进**：支持短路径、完整路径和自定义路径格式。

### Fixed
- 修复日志插入时可能导致的语法错误问题。
- 修复在某些情况下日志高亮未正确更新的问题。
- 修复多文件工作区中路径显示不一致的问题。

## [1.1.1] - 2025-04-24

### Added
- 新增日志浏览器面板，支持工作区和当前文件两种模式
- 新增日志导航功能，可通过快捷键 `Alt+N` 和 `Alt+P` 在日志间跳转
- MacOS 使用者可通过 `Cmd+[` 和 `Cmd+]` 快捷键在日志间跳转
- 新增日志高亮功能，支持通过 `Cmd+Shift+L` 快捷键开关(Windows/Linux 使用 `Ctrl+alt+H`)
- 新增日志项右键菜单，可直接跳转到日志位置
- 支持更多日志类型：info、debug、table、trace 等
- 状态栏显示当前日志数量和导航位置

### Changed
- 改进日志格式化，支持更多自定义选项
- 优化变量识别和格式化逻辑
- 改进错误处理和用户提示

### Fixed
- 修复在某些情况下日志插入位置不正确的问题
- 修复在删除日志时可能导致的编辑器崩溃问题
- 修复多文件工作区中路径显示错误问题

## [1.0.0] - 2025-03-21
- Initial release
- 插入 console.log: `Ctrl+1` (Mac: `Cmd+1`)
- 插入 console.error: `Ctrl+2` (Mac: `Cmd+2`)
- 注释所有 console 语句: `Ctrl+F1` (Mac: `Cmd+F1`)
- 取消注释所有 console 语句: `Ctrl+F2` (Mac: `Cmd+F2`)
- 移除所有 console 语句: `Ctrl+F3` (Mac: `Cmd+F3`)