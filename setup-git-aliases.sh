#!/bin/bash

echo "🚀 设置 Git 增强别名..."
echo ""

# 基础别名 - 推荐日常使用
echo "📝 设置基础别名..."
git config --global alias.lg "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)(%ar)%C(reset) %s %C(red)%d%C(reset)' --graph --abbrev-commit"

git config --global alias.lgs "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)%ad%C(reset) %s %C(red)%d%C(reset)' --date=short --stat --graph --abbrev-commit"

git config --global alias.lgf "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)(%ar)%C(reset) %C(cyan)%ad%C(reset) %s %C(red)%d%C(reset)' --date=short --name-status --graph --abbrev-commit"

git config --global alias.lgo "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%-15an%C(reset) %C(green)%ad%C(reset) %C(cyan)%s%C(reset) %C(red)%d%C(reset)' --date=format:'%m-%d %H:%M' --abbrev-commit -10"

# 高级别名
echo "⚡ 设置高级别名..."
git config --global alias.ll "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)%ad%C(reset) %C(cyan)%s%C(reset) %C(red)%d%C(reset)' --date=format:'%Y-%m-%d %H:%M' --numstat --abbrev-commit"

git config --global alias.tree "log --graph --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)(%ar)%C(reset) %s %C(red)%d%C(reset)' --abbrev-commit --all"

git config --global alias.recent "log -10 --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%-20an%C(reset) %C(green)%ad%C(reset) %C(cyan)%s%C(reset)' --date=format:'%m/%d %H:%M' --stat"

git config --global alias.today "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)%ad%C(reset) %C(cyan)%s%C(reset)' --date=format:'%H:%M' --since='00:00:00' --all"

# 实用工具别名
echo "🔧 设置实用工具别名..."
git config --global alias.author "log --pretty=format:'%C(yellow)%h%C(reset) %C(green)%ad%C(reset) %C(cyan)%s%C(reset)' --date=short --author"

git config --global alias.filelog "log --pretty=format:'%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)%ad%C(reset) %C(cyan)%s%C(reset)' --date=short --follow --patch --"

# 额外的实用别名
echo "🎯 设置额外实用别名..."
git config --global alias.st "status -s"
git config --global alias.co "checkout"
git config --global alias.br "branch"
git config --global alias.ci "commit"
git config --global alias.unstage "reset HEAD --"
git config --global alias.last "log -1 HEAD"
git config --global alias.visual "!gitk"

echo ""
echo "✅ Git 别名设置完成！"
echo ""
echo "🎨 可用的日志命令："
echo "  git lg     - 📊 基础图形化日志 (推荐)"
echo "  git lgs    - 📈 带文件统计的日志"
echo "  git lgf    - 📋 带文件名的日志"
echo "  git lgo    - 📝 紧凑一行日志"
echo "  git ll     - 🔢 详细数字统计"
echo "  git tree   - 🌳 分支树形图"
echo "  git recent - ⏰ 最近10次提交"
echo "  git today  - 📅 今天的提交"
echo ""
echo "🛠️  实用工具命令："
echo "  git author '姓名'  - 👤 查看某人的提交"
echo "  git filelog 文件   - 📄 查看文件历史"
echo "  git st             - 📋 简洁状态"
echo "  git unstage 文件   - ↩️  取消暂存"
echo "  git last           - 🔚 最后一次提交"
echo ""
echo "🎉 现在试试: git lg" 