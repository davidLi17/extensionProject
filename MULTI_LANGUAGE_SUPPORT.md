# LogRush 多语言支持功能

## 概述

LogRush 现在支持多种编程语言的日志输出，可以根据当前文件类型自动选择合适的日志方法，也支持完全自定义的日志方法。

## 新增配置项

### 1. 启用自定义日志方法
```json
"log-rush.EnableCustomLogMethod": {
    "type": "boolean",
    "default": false,
    "description": "启用自定义日志方法（忽略日志类型，直接使用LogMethod配置）"
}
```

### 2. 语言特定日志方法
```json
"log-rush.LanguageSpecificMethods": {
    "type": "object",
    "default": {
        "python": "print",
        "javascript": "console.log",
        "typescript": "console.log",
        "java": "System.out.println",
        "csharp": "Console.WriteLine",
        "cpp": "std::cout",
        "c": "printf",
        "go": "fmt.Println",
        "rust": "println!",
        "php": "echo",
        "ruby": "puts"
    },
    "description": "特定语言的日志方法配置"
}
```

### 3. 自动语言检测
```json
"log-rush.AutoDetectLanguage": {
    "type": "boolean",
    "default": true,
    "description": "自动检测语言并使用相应的日志方法"
}
```

## 支持的语言和格式

### Python
```python
# 输出格式
print(f"文件名 变量名:: {变量}")
```

### Java
```java
// 输出格式
System.out.println("文件名 变量名:: " + 变量);
```

### C#
```csharp
// 输出格式
Console.WriteLine($"文件名 变量名:: {变量}");
```

### C/C++
```cpp
// 输出格式
std::cout << "文件名 变量名:: " << 变量 << std::endl;
```

### Go
```go
// 输出格式
fmt.Println("文件名 变量名::", 变量)
```

### Rust
```rust
// 输出格式
println!("文件名 变量名:: {}", 变量);
```

### PHP
```php
// 输出格式
echo "文件名 变量名:: " . $变量;
```

### Ruby
```ruby
# 输出格式
puts "文件名 变量名:: #{变量}"
```

## 快捷键

- `Ctrl+1` (Mac: `Cmd+1`): 插入 console.log 或语言特定的日志
- `Ctrl+2` (Mac: `Cmd+2`): 插入 console.error 或语言特定的错误日志
- `Ctrl+3` (Mac: `Cmd+3`): 插入自定义日志方法（强制使用 LogMethod 配置）

## 使用场景

### 场景1：Python开发
1. 打开Python文件
2. 选择一个变量
3. 按 `Ctrl+1`
4. 自动插入：`print(f"文件名 变量名:: {变量}")`

### 场景2：自定义日志方法
1. 在设置中配置 `log-rush.LogMethod` 为你想要的方法，如 `logger.debug`
2. 启用 `log-rush.EnableCustomLogMethod`
3. 按 `Ctrl+3` 使用自定义日志方法

### 场景3：混合项目
1. 启用 `log-rush.AutoDetectLanguage`
2. 在不同语言文件中使用相同快捷键
3. 自动根据文件类型选择合适的日志方法

## 配置示例

### 为Python项目配置自定义日志
```json
{
    "log-rush.EnableCustomLogMethod": true,
    "log-rush.LogMethod": "logger.info",
    "log-rush.AutoDetectLanguage": false
}
```

### 为多语言项目配置
```json
{
    "log-rush.AutoDetectLanguage": true,
    "log-rush.LanguageSpecificMethods": {
        "python": "print",
        "javascript": "console.log",
        "typescript": "console.log",
        "java": "System.out.println",
        "go": "fmt.Printf"
    }
}
```

## 注意事项

1. 当 `EnableCustomLogMethod` 为 true 时，会忽略日志类型（log/error/warn等），直接使用 `LogMethod` 配置
2. 当 `AutoDetectLanguage` 为 true 时，会根据文件扩展名自动选择日志方法
3. 对于JavaScript/TypeScript，仍然支持不同的日志级别（log/error/warn/info）
4. 其他语言目前主要支持通用的打印输出

## 故障排除

如果日志格式不符合预期：
1. 检查 `AutoDetectLanguage` 设置
2. 确认当前文件的语言ID是否在 `LanguageSpecificMethods` 中配置
3. 尝试使用 `Ctrl+3` 强制使用自定义日志方法 