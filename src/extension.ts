// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {
    removeLog,
    commentLog,
    uncommentLog
  } from '@/ctrl-key/quickRemoveLog';
import  {
    quickLog,
    quickError,
    quickWarn,
    quickInfo
}  from '@/ctrl-key/quickLog';
// 插件激活 -  这段代码是用来激活插件的，当你的VS Code启动并加载这个插件的时候，这段代码就会运行。
export function activate(context: vscode.ExtensionContext) { //  注意这里要加上 export， 导出 activate 函数
	// 订阅 注册的命令 -  把注册的命令添加到插件的订阅列表里，这样当插件被激活的时候，这个命令才能被 VS Code 识别和使用。
	context.subscriptions.push(removeLog);
	context.subscriptions.push(commentLog);
	context.subscriptions.push(uncommentLog);
	context.subscriptions.push(quickError);
	context.subscriptions.push(quickWarn);
	context.subscriptions.push(quickInfo);
	context.subscriptions.push(quickLog);
}

// 插件卸载 -  这段代码是用来处理插件卸载的，当你的 VS Code 插件被卸载或者禁用的时候，这段代码会被执行。
//  现在这个函数是空的，表示插件卸载的时候不需要做额外的操作。
export function deactivate() {} //  注意这里要加上 export， 导出 deactivate 函数

// 导出模块
//  module.exports  是 Node.js 模块化的语法，用来导出模块的内容，让其他模块可以引用。
//  在这里，它导出了 activate 和 deactivate 两个函数，这样 VS Code 才能找到并执行这两个函数，从而激活和卸载插件。
//  CommonJS 导出方式， 如果你的项目配置了 "type": "module" (在 package.json 里)， 就要用 ES Module 的导出方式 (export default { activate, deactivate };)
// module.exports = { //  CommonJS 导出方式， 适用于默认的 VS Code 插件项目
// 	activate,
// 	deactivate
// };

// ES Module 导出方式 (如果你的 package.json 里有 "type": "module" 或者是TS文件)
export default {
    activate,
    deactivate
};
