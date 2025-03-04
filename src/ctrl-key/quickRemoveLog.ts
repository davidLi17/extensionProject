import { VSCodeHelper } from "@/utils";
import * as vscode from "vscode";
const removeLog=vscode.commands.registerCommand('log-rush.removeLog',function(){
    const editor=vscode.window.activeTextEditor;
    if(!editor){
    return;
    }
    const document = editor.document;
    let selection = editor.selection;
    //如果没有选择文本,则默认选择整个文档.
    let txt='';
    let entireDocument =false;
    if(selection.isEmpty){
        const fullRange=new vscode.Range(0,0,document.lineCount-1,document.lineAt(document.lineCount-1).text.length);
        selection=new vscode.Selection(fullRange.start,fullRange.end);
        entireDocument=true;
    }
    txt=document.getText(selection);

    const regex = /^\s*(?:\/\/\s*)?console\s*\.\s*(log|info|error|warn|debug|table|dir|trace|group|groupCollapsed|groupEnd|clear|count|countReset|time|timeLog)\s*\([^)]*\)\s*;?\s*$/gm;
    const lines=txt.split('\n');
    const filteredLines=lines.filter(lines=>!regex.test(lines));
    const newText=filteredLines.join('\n');

    if(newText===txt){
        VSCodeHelper.showWarningMessage('没有找到 Console 语句');
        return;
    }
    editor.edit(editBuilder=>{
        editBuilder.replace(selection,newText);
}).then(success=>{
    if(success){
        const count=(txt.match(regex)||[]).length;
        VSCodeHelper.showInfoMessage(`成功移除了 ${count} 个 Console 语句`);
    }
});
});
const commentLog=vscode.commands.registerCommand('log-rush.commentLog',function(){
    const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  
  const document = editor.document;
  let selection = editor.selection;
  
  // 如果没有选择文本，则默认选择整个文档
  let txt = '';
  
  if (selection.isEmpty) {
    const fullRange = new vscode.Range(
      0, 0,
      document.lineCount - 1,
      document.lineAt(document.lineCount - 1).text.length
    );
    selection = new vscode.Selection(fullRange.start, fullRange.end);
  }
  
  txt = document.getText(selection);
  // 正则表达式匹配 console 调用的行
  const regex = /^(\s*)(console\s*\.\s*(log|info|error|warn|debug|table|dir|trace)\s*\([^)]*\)\s*;?)$/gm;

  
    // 注释 console 语句，保留原有缩进
    const newText = txt.replace(regex, '$1// $2');
  
  // 如果没有发生实际替换，提醒用户
  if (newText === txt) {
    VSCodeHelper.showWarningMessage('没有找到 Console 语句或所有语句已被注释');
    return;
  }

  editor.edit(editBuilder => {
    editBuilder.replace(selection, newText);
  }).then(success => {
    if (success) {
      const count = (txt.match(regex) || []).length;
      VSCodeHelper.showInfoMessage(`已注释 ${count} 个 Console 语句`);
    }
  });
});
const uncommentLog = vscode.commands.registerCommand('log-rush.uncommentLog', function () {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    
    const document = editor.document;
    let selection = editor.selection;
    
    // 如果没有选择文本，则默认选择整个文档
    let txt = '';
    
    if (selection.isEmpty) {
      const fullRange = new vscode.Range(
        0, 0,
        document.lineCount - 1,
        document.lineAt(document.lineCount - 1).text.length
      );
      selection = new vscode.Selection(fullRange.start, fullRange.end);
    }
    
    txt = document.getText(selection);
  
    // 正则表达式匹配被注释的 console 调用
    const regex = /^(\s*)\/\/\s*(console\s*\.\s*(log|info|error|warn|debug|table|dir|trace)\s*\([^)]*\)\s*;?)$/gm;

    
    // 取消注释 console 语句
    const newText = txt.replace(regex, '$1$2');
    
    // 如果没有发生实际替换，提醒用户
    if (newText === txt) {
      VSCodeHelper.showWarningMessage('没有找到被注释的 Console 语句');
      return;
    }
  
    editor.edit(editBuilder => {
      editBuilder.replace(selection, newText);
    }).then(success => {
      if (success) {
        const count = (txt.match(regex) || []).length;
        VSCodeHelper.showInfoMessage(`已取消注释 ${count} 个 Console 语句`);
      }
    });
  });
  export {
    removeLog,
    commentLog,
    uncommentLog
  };