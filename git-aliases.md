# Git 优化输出命令别名

## 基础增强版 git log

### 1. 简洁版本 (推荐)
```bash
git config --global alias.lg "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)(%ar)%C(reset) %s %C(red)%d%C(reset)' --graph --abbrev-commit"
```

**输出效果:**
```
* a1b2c3d 张三 (2 hours ago) 修复登录bug (origin/main, main)
* d4e5f6g 李四 (1 day ago) 添加用户管理功能
* g7h8i9j 王五 (3 days ago) 初始化项目
```

### 2. 详细版本 (包含文件统计)
```bash
git config --global alias.lgs "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)%ad%C(reset) %s %C(red)%d%C(reset)' --date=short --stat --graph --abbrev-commit"
```

**输出效果:**
```
* a1b2c3d 张三 2024-01-15 修复登录bug (origin/main, main)
 src/auth/login.js | 5 +++--
 tests/auth.test.js | 3 +++
 2 files changed, 6 insertions(+), 2 deletions(-)

* d4e5f6g 李四 2024-01-14 添加用户管理功能
 src/user/manager.js | 45 +++++++++++++++++++++++++++++++++++++++++++++
 src/user/api.js     | 23 +++++++++++++++++++++++
 2 files changed, 68 insertions(+)
```

### 3. 超详细版本 (包含修改的具体文件名)
```bash
git config --global alias.lgf "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)(%ar)%C(reset) %C(cyan)%ad%C(reset) %s %C(red)%d%C(reset)' --date=short --name-status --graph --abbrev-commit"
```

**输出效果:**
```
* a1b2c3d 张三 (2 hours ago) 2024-01-15 修复登录bug (origin/main, main)
M       src/auth/login.js
M       tests/auth.test.js

* d4e5f6g 李四 (1 day ago) 2024-01-14 添加用户管理功能
A       src/user/manager.js
A       src/user/api.js
```

### 4. 紧凑版本 (一行显示所有信息)
```bash
git config --global alias.lgo "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%-15an%C(reset) %C(green)%ad%C(reset) %C(cyan)%s%C(reset) %C(red)%d%C(reset)' --date=format:'%m-%d %H:%M' --abbrev-commit -10"
```

**输出效果:**
```
a1b2c3d 张三            01-15 14:30 修复登录bug (origin/main, main)
d4e5f6g 李四            01-14 09:15 添加用户管理功能
g7h8i9j 王五            01-12 16:45 初始化项目
```

## 高级别名

### 5. 带文件变更统计的彩色输出
```bash
git config --global alias.ll "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)%ad%C(reset) %C(cyan)%s%C(reset) %C(red)%d%C(reset)' --date=format:'%Y-%m-%d %H:%M' --numstat --abbrev-commit"
```

**输出效果:**
```
a1b2c3d 张三 2024-01-15 14:30 修复登录bug (origin/main, main)
3       2       src/auth/login.js
5       0       tests/auth.test.js

d4e5f6g 李四 2024-01-14 09:15 添加用户管理功能
45      0       src/user/manager.js
23      0       src/user/api.js
```

### 6. 分支图形化显示
```bash
git config --global alias.tree "log --graph --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)(%ar)%C(reset) %s %C(red)%d%C(reset)' --abbrev-commit --all"
```

### 7. 最近N次提交的详细信息
```bash
git config --global alias.recent "log -10 --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%-20an%C(reset) %C(green)%ad%C(reset) %C(cyan)%s%C(reset)' --date=format:'%m/%d %H:%M' --stat"
```

## 实用的组合别名

### 8. 查看某个作者的提交
```bash
git config --global alias.author "log --pretty=format:'%C(yellow)%h%C(reset) %C(green)%ad%C(reset) %C(cyan)%s%C(reset)' --date=short --author"
```

**使用方法:**
```bash
git author "张三"
```

### 9. 查看今天的提交
```bash
git config --global alias.today "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)%ad%C(reset) %C(cyan)%s%C(reset)' --date=format:'%H:%M' --since='00:00:00' --all"
```

### 10. 查看文件的修改历史
```bash
git config --global alias.filelog "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)%ad%C(reset) %C(cyan)%s%C(reset)' --date=short --follow --patch --"
```

**使用方法:**
```bash
git filelog src/main.js
```

## 一键设置所有别名

创建一个脚本文件 `setup-git-aliases.sh`:

```bash
#!/bin/bash

echo "设置 Git 别名..."

# 基础别名
git config --global alias.lg "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)(%ar)%C(reset) %s %C(red)%d%C(reset)' --graph --abbrev-commit"

git config --global alias.lgs "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)%ad%C(reset) %s %C(red)%d%C(reset)' --date=short --stat --graph --abbrev-commit"

git config --global alias.lgf "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)(%ar)%C(reset) %C(cyan)%ad%C(reset) %s %C(red)%d%C(reset)' --date=short --name-status --graph --abbrev-commit"

git config --global alias.lgo "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%-15an%C(reset) %C(green)%ad%C(reset) %C(cyan)%s%C(reset) %C(red)%d%C(reset)' --date=format:'%m-%d %H:%M' --abbrev-commit -10"

git config --global alias.ll "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)%ad%C(reset) %C(cyan)%s%C(reset) %C(red)%d%C(reset)' --date=format:'%Y-%m-%d %H:%M' --numstat --abbrev-commit"

git config --global alias.tree "log --graph --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)(%ar)%C(reset) %s %C(red)%d%C(reset)' --abbrev-commit --all"

git config --global alias.recent "log -10 --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%-20an%C(reset) %C(green)%ad%C(reset) %C(cyan)%s%C(reset)' --date=format:'%m/%d %H:%M' --stat"

git config --global alias.today "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)%ad%C(reset) %C(cyan)%s%C(reset)' --date=format:'%H:%M' --since='00:00:00' --all"

echo "Git 别名设置完成！"
echo ""
echo "可用的命令："
echo "  git lg     - 基础图形化日志"
echo "  git lgs    - 带文件统计的日志"
echo "  git lgf    - 带文件名的日志"
echo "  git lgo    - 紧凑一行日志"
echo "  git ll     - 详细数字统计"
echo "  git tree   - 分支树形图"
echo "  git recent - 最近10次提交"
echo "  git today  - 今天的提交"
```

## 使用说明

1. **推荐使用 `git lg`** - 这是最平衡的版本，信息丰富且易读
2. **查看文件变更用 `git lgs`** - 显示每次提交修改了哪些文件
3. **快速浏览用 `git lgo`** - 紧凑格式，适合快速扫描
4. **详细分析用 `git ll`** - 显示具体的增删行数

## 颜色说明

- **黄色**: commit hash
- **蓝色**: 作者姓名
- **绿色**: 日期/时间
- **青色**: 提交信息
- **红色**: 分支信息

这些别名让你的 git log 输出更加美观和实用！ 