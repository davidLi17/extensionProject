import * as vscode from 'vscode';
import * as path from 'path';

import { LogConfig, LogFormatType, LogType } from '@/types/index';
function getLogConfig(): LogConfig {
    const logOption = vscode.workspace.getConfiguration("quick-console-logger");
    
    return {
      logMethod: logOption.get("LogMethod") || "console.log",
      varPilotSymbol: logOption.get("VarPilotSymbol") || '::',
      quotationMark: logOption.get("QuotationMark") === "single" ? `'` : `"`,
      showLogSemicolon: logOption.get("ShowLogSemicolon") || false,
      showLineNumber: logOption.get("ShowLineTag") || false,
      showFilePath: logOption.get("ShowFilePath") || false,
      filePathType: logOption.get("FilePathType") || LogFormatType.SHORT,
      lineTagPosition: logOption.get("LineTagAtBeginOrEnd") || 'begin',
      customFormat: logOption.get("CustomFormat") || '${fileName} ${varName}::: '
    };
  }
function getLogEnd(config: LogConfig): string {
  return config.showLogSemicolon ? ");" : ")";
}

function generateLogStatement(
    document: vscode.TextDocument,
    insertSection: vscode.Selection,
    word: string,
    config: LogConfig,
    logMethod: string = config.logMethod
  ): string {
    // 获取文件信息
    const fileName = path.basename(document.fileName);
    const fileDir = path.dirname(document.fileName);
    const relativePath = path.join(path.basename(fileDir), fileName);
    
    // 获取行号信息
    const lineNumber = config.showLineNumber ? `line:${insertSection.end.line + 1}` : '';
    
    // 构建文件路径部分
    let filePathStr = '';
    if (config.showFilePath) {
      switch (config.filePathType) {
        case LogFormatType.SHORT:
          filePathStr = fileName;
          break;
        case LogFormatType.FULL:
          filePathStr = relativePath;
          break;
        case LogFormatType.CUSTOM:
          filePathStr = document.fileName; // 完整路径，可以自定义处理
          break;
      }
    }
  
    // 构建日志前缀
    let logPrefix = '';
    
    if (config.customFormat && config.filePathType === LogFormatType.CUSTOM) {
      // 使用自定义格式
      logPrefix = config.customFormat
        .replace('${fileName}', fileName)
        .replace('${filePath}', relativePath)
        .replace('${fullPath}', document.fileName)
        .replace('${varName}', word)
        .replace('${lineNumber}', lineNumber);
    } else {
      // 使用标准格式
      if (config.lineTagPosition === 'begin' && lineNumber) {
        logPrefix = `${lineNumber} ${filePathStr} ${word}${config.varPilotSymbol}`;
      } else {
        logPrefix = `${filePathStr} ${word}${config.varPilotSymbol}`;
        if (lineNumber) {
          logPrefix += ` ${lineNumber}`;
        }
      }
    }
  
    // 构建完整日志语句
    return `${logMethod}(${config.quotationMark}${logPrefix}${config.quotationMark}, ${word}${getLogEnd(config)}`;
  }
function insertConsoleLog(logType:LogType){
    const editor=vscode.window.activeTextEditor;
    if(!editor) return;
    const document=editor.document;
    const varSelection=editor.selection;
    const word=document.getText(varSelection);//word is the selected text
    const config=getLogConfig();
    const logMethod=`console.${logType}`;
    if(!word){
        const value=new vscode.SnippetString(`${logMethod}(${config.varPilotSymbol}${config.quotationMark}${config.varPilotSymbol}${getLogEnd(config)})`);
        editor.insertSnippet(value,varSelection.start);
        return;
    }
    vscode.commands.executeCommand("editor.action.insertLineAfter").then(()=>{
        const insertSection=editor.selection;
        editor.edit((editBuilder)=>{
            const logStatement=generateLogStatement(document, insertSection, word, config, logMethod);
            editBuilder.insert(insertSection.start,logStatement);
        });
    });
}
const quickLog = vscode.commands.registerTextEditorCommand(
    "quick-console-logger.qlog",
    function() {
      insertConsoleLog(LogType.LOG);
    }
  );
  const quickError = vscode.commands.registerTextEditorCommand(
    "quick-console-logger.qerror",
    function() {
      insertConsoleLog(LogType.ERROR);
    }
  );
  const quickWarn = vscode.commands.registerTextEditorCommand(
    "quick-console-logger.qwarn",
    function() {
      insertConsoleLog(LogType.WARN);
    }
  );
  const quickInfo = vscode.commands.registerTextEditorCommand(
    "quick-console-logger.qinfo",
    function() {
      insertConsoleLog(LogType.INFO);
    }
  );
export {
    quickLog,
    quickError,
    quickWarn,
    quickInfo
}