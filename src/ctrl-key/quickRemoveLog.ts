import { VSCodeHelper } from "@/utils";
import * as vscode from "vscode";

// 用于匹配 console 语句的正则表达式
const CONSOLE_REGEX = /^\s*(console\s*\.\s*(log|info|error|warn|debug|table|dir|trace|group|groupCollapsed|groupEnd|clear|count|countReset|time|timeLog)\s*\([^)]*\)\s*;?\s*)$/gm;
// 用于匹配已注释的 console 语句的正则表达式
const COMMENTED_CONSOLE_REGEX = /^(\s*)\/\/\s*(console\s*\.\s*(log|info|error|warn|debug|table|dir|trace|group|groupCollapsed|groupEnd|clear|count|countReset|time|timeLog)\s*\([^)]*\)\s*;?\s*)$/gm;

async function handleLogOperation(options: {
  operation: 'remove' | 'comment' | 'uncomment';
  successMessage: string;
  warningMessage: string;
  transform: (text: string) => string;
}): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  let selection = editor.selection;

  if (selection.isEmpty) {
    const fullRange = new vscode.Range(
      0, 0,
      document.lineCount - 1,
      document.lineAt(document.lineCount - 1).text.length
    );
    selection = new vscode.Selection(fullRange.start, fullRange.end);
  }

  const txt = document.getText(selection);
  const newText = options.transform(txt);

  if (newText === txt) {
    VSCodeHelper.showWarningMessage(options.warningMessage);
    return;
  }

  const success = await editor.edit(editBuilder => {
    editBuilder.replace(selection, newText);
  });

  if (success) {
    let count = 0;
    if (options.operation === 'remove') {
      CONSOLE_REGEX.lastIndex = 0;
      const matches1 = txt.match(CONSOLE_REGEX) || [];
      COMMENTED_CONSOLE_REGEX.lastIndex = 0;
      const matches2 = txt.match(COMMENTED_CONSOLE_REGEX) || [];
      count = matches1.length + matches2.length;
    } else if (options.operation === 'comment') {
      CONSOLE_REGEX.lastIndex = 0;
      count = (txt.match(CONSOLE_REGEX) || []).length;
    } else {
      COMMENTED_CONSOLE_REGEX.lastIndex = 0;
      count = (txt.match(COMMENTED_CONSOLE_REGEX) || []).length;
    }
    VSCodeHelper.showInfoMessage(`${options.successMessage} ${count} 个 Console 语句`);
  }
}

const removeLog = vscode.commands.registerCommand('log-rush.removeLog', () => {
  return handleLogOperation({
    operation: 'remove',
    successMessage: '成功移除了',
    warningMessage: '没有找到 Console 语句',
    transform: (txt: string) => {
      const lines = txt.split('\n');
      const filteredLines = lines.filter(line => {
        CONSOLE_REGEX.lastIndex = 0;
        COMMENTED_CONSOLE_REGEX.lastIndex = 0;
        return !CONSOLE_REGEX.test(line) && !COMMENTED_CONSOLE_REGEX.test(line);
      });
      return filteredLines.join('\n');
    }
  });
});

const commentLog = vscode.commands.registerCommand('log-rush.commentLog', () => {
  return handleLogOperation({
    operation: 'comment',
    successMessage: '已注释',
    warningMessage: '没有找到 Console 语句或所有语句已被注释',
    transform: (txt: string) => {
      return txt.replace(CONSOLE_REGEX, (matchStr, p1, p2, offset, string) => {
        // 获取行首的空白字符
        const matchResult = matchStr.match(/^\s*/);
        const indentation = matchResult ? matchResult[0] : '';
        return `${indentation}// ${p1}`;
      });
    }
  });
});

const uncommentLog = vscode.commands.registerCommand('log-rush.uncommentLog', () => {
  return handleLogOperation({
    operation: 'uncomment',
    successMessage: '已取消注释',
    warningMessage: '没有找到被注释的 Console 语句',
    transform: (txt: string) => {
      return txt.replace(COMMENTED_CONSOLE_REGEX, '$1$2');
    }
  });
});

export {
  removeLog,
  commentLog,
  uncommentLog
};