import { VSCodeHelper } from "@/utils"; // 从自定义工具库引入 VSCodeHelper 以便显示消息等辅助功能
import * as vscode from "vscode"; // 引入 vscod API，用于与 Visual Studio Code 交互

// 定义正则表达式，用于匹配普通的 console 语句
const CONSOLE_REGEX =
	/(^|\s*)(console\s*\.\s*(log|info|error|warn|debug|table|dir|trace|group|groupCollapsed|groupEnd|clear|count|countReset|time|timeLog)\s*\([^)]*\)\s*;?)/gm;
// 说明：
// (^|\s*)                   - 匹配行首或空白字符，用于捕获前导空白，以便操作时保持格式
// console\s*\.\s*          - 匹配 console.，允许空格
// (log|info|error|warn|debug|table|dir|trace|group|groupCollapsed|groupEnd|clear|count|countReset|time|timeLog) - 匹配具体的 console 方法名
// \s*\([^)]*\)             - 匹配括号内内容（即参数），允许空格，非贪婪匹配
// \s*;?                    - 匹配可选的行尾分号
// 这些组合用于检测各种 console 调用语句

// 定义正则表达式，用于匹配被注释掉的 console 语句（即前面有 // 的）
const COMMENTED_CONSOLE_REGEX =
	/(^|\s*)\/\/\s*(console\s*\.\s*(log|info|error|warn|debug|table|dir|trace|group|groupCollapsed|groupEnd|clear|count|countReset|time|timeLog)\s*\([^)]*\)\s*;?)/gm;
// 说明：
// (^|\s*)                - 捕获行首或空白字符
// \/\/\s*               - 匹配 // 和后续空白符
// 后续部分同上，用于匹配具体的 console 调用

// 定义异步函数，用于处理 console 语句的操作（删除、注释、取消注释）
async function handleLogOperation({
	operation, // 操作类型："remove"（删除）、"comment"（注释）、"uncomment"（取消注释）
	successMessage, // 操作成功后显示的信息
	warningMessage, // 操作失败或未找到符合条件的语句时显示的提示
	transform, // 一个函数，接收文本，返回操作后修改的文本
	matchRegex, // 用于匹配目标 console 语句的正则表达式
}: {
	operation: "remove" | "comment" | "uncomment"; // 操作类型限制
	successMessage: string; // 操作成功提示
	warningMessage: string; // 操作失败提示
	transform: (txt: string) => string; // 变换文本的函数
	matchRegex: RegExp; // 匹配目标语句的正则
}) {
	const editor = vscode.window.activeTextEditor; // 获取当前激活的编辑器
	if (!editor) return; // 如果没有激活的编辑器，则退出函数

	const document = editor.document; // 获取当前文档对象
	let selection = editor.selection; // 获取当前选择区域
	if (selection.isEmpty) {
		// 如果没有选择任何内容（为空）
		// 定义新的选择范围为全文，从位置0到文档总长
		selection = new vscode.Selection(
			document.positionAt(0), // 文档开头位置
			document.positionAt(document.getText().length) // 文档末尾位置
		);
	}
	const txt = document.getText(selection); // 获取选择区域的文本
	const matchCount = (txt.match(matchRegex) || []).length; // 统计匹配的 console 语句数量
	if (matchCount === 0) {
		// 如果没有匹配到任何 console 语句
		VSCodeHelper.showWarningMessage(warningMessage); // 显示警告信息
		return; // 退出函数
	}
	const newText = transform(txt); // 调用变换函数，得到操作后的新文本
	const success = await editor.edit((editBuilder) => {
		// 执行文本替换
		editBuilder.replace(selection, newText); // 替换选择区域为新文本
	});
	if (success) {
		// 如果替换成功
		VSCodeHelper.showInfoMessage(
			`${successMessage} ${matchCount} 个 Console 语句` // 显示成功提示，包含操作数量
		);
	}
}

// 注册删除 console 语句的命令
const removeLog = vscode.commands.registerCommand("log-rush.removeLog", () =>
	handleLogOperation({
		operation: "remove", // 操作类型为删除
		successMessage: "成功移除了", // 成功提示
		warningMessage: "没有找到 Console 语句", // 未找到匹配语句提示
		transform: (txt) => txt.replace(CONSOLE_REGEX, ""), // 通过正则替换为空字符串，实现删除操作
		matchRegex: CONSOLE_REGEX, // 匹配所有 console 语句
	})
);

// 注册注释 console 语句的命令
const commentLog = vscode.commands.registerCommand("log-rush.commentLog", () =>
	handleLogOperation({
		operation: "comment", // 操作类型为注释
		successMessage: "已注释", // 成功提示
		warningMessage: "没有找到 Console 语句或所有语句已被注释", // 未找到或已注释全部提示
		transform: (txt) =>
			txt.replace(CONSOLE_REGEX, (m, p1, p2) => `${p1}// ${p2}`), // 在匹配的 console 方法前加上 //，实现注释
		matchRegex: CONSOLE_REGEX, // 使用相同正则匹配
	})
);

// 注册取消注释 console 语句的命令
const uncommentLog = vscode.commands.registerCommand(
	"log-rush.uncommentLog", // 命令ID
	() =>
		handleLogOperation({
			operation: "uncomment", // 操作类型为取消注释
			successMessage: "已取消注释", // 成功提示
			warningMessage: "没有找到被注释的 Console 语句", // 未找到被注释的语句
			transform: (txt) => txt.replace(COMMENTED_CONSOLE_REGEX, "$1$2"), // 移除前置的 //，实现取消注释
			matchRegex: COMMENTED_CONSOLE_REGEX, // 使用被注释的正则匹配
		})
);

// 导出三个命令，以便在扩展中注册使用
export { removeLog, commentLog, uncommentLog };
