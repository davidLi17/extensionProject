import * as vscode from "vscode";
import * as path from "path";
import {
  debugCodeAnalysis,
  debugObjectMethodAnalysis,
  findValidInsertionPoint,
  getEnclosingContextName,
} from "@/utils/codeAnalyzer";

import { LogConfig, LogFormatType, LogType } from "@/types/index";
import { LogHighlighter } from "@/utils/logHighlighter";
function getLogConfig(): LogConfig {
  const logOption = vscode.workspace.getConfiguration("log-rush");

  return {
    logMethod: logOption.get("LogMethod") || "console.log",
    varPilotSymbol: logOption.get("VarPilotSymbol") || "::",
    quotationMark: logOption.get("QuotationMark") === "single" ? `'` : `"`,
    showLogSemicolon: logOption.get("ShowLogSemicolon") || false,
    showLineNumber: logOption.get("ShowLineTag") || false,
    showFilePath: logOption.get("ShowFilePath") || false,
    filePathType: logOption.get("FilePathType") || LogFormatType.SHORT,
    lineTagPosition: logOption.get("LineTagAtBeginOrEnd") || "begin",
    customFormat:
      logOption.get("CustomFormat") ||
      "${filePath}: ${functionName}->${varName}${varPilotSymbol}",
  };
}
function getLogEnd(config: LogConfig): string {
  return config.showLogSemicolon ? ");" : ")";
}
export function normalizePath(inputPath: string): string {
  return inputPath.replace(/\\/g, "/");
}
export function getFileInfo(document: vscode.TextDocument) {
  // 获取文件名并去掉扩展名
  const fileName = path.basename(document.fileName);

  // 获取文件目录路径并标准化
  const fileDir = normalizePath(path.dirname(document.fileName));

  // 获取最后一级目录名称
  const dirName = path.basename(fileDir);

  // 生成相对路径并标准化
  const relativePath = normalizePath(path.join(dirName, fileName));

  return { fileName, fileDir, relativePath };
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

  const fileDir = normalizePath(path.dirname(document.fileName));
  const dirName = path.basename(fileDir);
  const relativePath = normalizePath(path.join(dirName, fileName));

  // 获取行号信息
  const lineNumber = config.showLineNumber
    ? `l:${insertSection.end.line + 1}`
    : "";

  // 获取函数名和对象名信息
  const contextInfo = getEnclosingContextName(document, insertSection.start);
  const functionName = contextInfo.functionName || "";
  const objectName = contextInfo.objectName || "";

  // 构建上下文路径
  let contextPath = "";
  if (objectName && functionName) {
    contextPath = `${objectName}->${functionName}`;
  } else if (functionName) {
    contextPath = functionName;
  } else {
    contextPath = "";
  }

  // 构建文件路径部分
  let filePathStr = "";
  if (config.showFilePath) {
    switch (config.filePathType) {
      case LogFormatType.SHORT:
        filePathStr = fileName;
        break;
      case LogFormatType.FULL:
        filePathStr = relativePath;
        break;
      case LogFormatType.CUSTOM:
        filePathStr = normalizePath(document.fileName);
        break;
    }
  }

  // 构建日志前缀
  let logPrefix = "";

  if (config.customFormat && config.filePathType === LogFormatType.CUSTOM) {
    // 使用自定义格式:
    logPrefix = config.customFormat
      .replace("${fileName}", fileName)
      .replace("${filePath}", relativePath)
      .replace("${fullPath}", normalizePath(document.fileName))
      .replace("${functionName}", functionName)
      .replace("${objectName}", objectName)
      .replace("${contextPath}", contextPath)
      .replace("${varName}", word)
      .replace("${lineNumber}", lineNumber)
      .replace("${varPilotSymbol}", config.varPilotSymbol);
  } else if (config.filePathType === LogFormatType.SHORT) {
    // 使用标准格式
    const contextDisplay = contextPath ? `${contextPath}->` : "";

    if (config.lineTagPosition === "begin" && lineNumber) {
      logPrefix = `${lineNumber} ${filePathStr} ${contextDisplay}${word}${config.varPilotSymbol}`;
    } else {
      logPrefix = `${filePathStr} ${contextDisplay}${word}${config.varPilotSymbol}`;
      if (lineNumber) {
        logPrefix += ` ${lineNumber}`;
      }
    }
  } else if (config.filePathType === LogFormatType.FULL) {
    // 使用标准格式
    const contextDisplay = contextPath ? `${contextPath}->` : "";
    if (config.lineTagPosition === "begin" && lineNumber) {
      logPrefix = `${lineNumber} ${filePathStr} ${contextDisplay}${word}${config.varPilotSymbol}`;
    } else {
      logPrefix = `${filePathStr} ${contextDisplay}${word}${config.varPilotSymbol}`;
      if (lineNumber) {
        logPrefix += ` ${lineNumber}`;
      }
    }
  }

  // 构建完整日志语句
  return `${logMethod}(${config.quotationMark}${logPrefix}${
    config.quotationMark
  }, ${word}${getLogEnd(config)}`;
}

function insertConsoleLog(logType: LogType) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  // 从编辑器对象中获取文档对象，该文档对象代表当前在编辑器中打开的文件内容
  const document = editor.document;
  // 从编辑器对象中获取当前的选择区域对象，该对象表示用户在编辑器中选中的文本范围
  const varSelection = editor.selection;
  // 从选择区域对象中获取活动位置，这个位置通常是光标所在的位置
  const position = editor.selection.active;
  // 通过文档对象和选择区域对象，获取用户在编辑器中选中的文本内容
  const word = document.getText(varSelection);
  // 调用 getLogConfig 函数来获取日志配置信息，这个配置信息可能包含日志输出的格式、级别等相关设置
  const config = getLogConfig();
  // 根据传入的 logType 变量，拼接出一个完整的控制台日志输出方法，例如 "console.log"、"console.error" 等
  const logMethod = `console.${logType}`;

  // 调用 debugCodeAnalysis 函数，传入文档对象、光标位置和选中的文本内容，可能用于对代码进行调试分析
  //   debugCodeAnalysis(document, position, word);
  //   if (word && word.length > 0)
  //     debugObjectMethodAnalysis(document, position, word);
  //   }
  // 没有选择变量的情况，使用带路径信息的s

  if (!word) {
    // 获取文件信息
    const fileName = path.basename(document.fileName);
    const fileDir = normalizePath(path.dirname(document.fileName));
    const dirName = path.basename(fileDir);
    const relativePath = normalizePath(path.join(dirName, fileName));

    // 获取行号信息
    const lineNumber = config.showLineNumber
      ? `l:${varSelection.end.line + 1}`
      : "";

    // 获取函数名和对象名信息
    const contextInfo = getEnclosingContextName(document, varSelection.start);
    const functionName = contextInfo.functionName || "";
    const objectName = contextInfo.objectName || "";

    // 构建上下文路径
    let contextPath = "";
    if (objectName && functionName) {
      contextPath = `${objectName}->${functionName}`;
    } else if (functionName) {
      contextPath = functionName;
    } else {
      contextPath = "";
    }

    // 构建文件路径部分
    let filePathStr = "";
    if (config.showFilePath) {
      switch (config.filePathType) {
        case LogFormatType.SHORT:
          filePathStr = fileName;
          break;
        case LogFormatType.FULL:
          filePathStr = relativePath;
          break;
        case LogFormatType.CUSTOM:
          filePathStr = normalizePath(document.fileName);
          break;
      }
    }

    // 构建日志前缀
    let logPrefix = "";
    const placeholderVar = "$1"; // 使用snippet的占位符

    if (config.customFormat && config.filePathType === LogFormatType.CUSTOM) {
      // 使用自定义格式
      logPrefix = config.customFormat
        .replace("${fileName}", fileName)
        .replace("${filePath}", relativePath)
        .replace("${fullPath}", normalizePath(document.fileName))
        .replace("${functionName}", functionName)
        .replace("${objectName}", objectName)
        .replace("${contextPath}", contextPath)
        .replace("${varName}", placeholderVar)
        .replace("${lineNumber}", lineNumber)
        .replace("${varPilotSymbol}", config.varPilotSymbol);
    } else if (
      config.filePathType === LogFormatType.SHORT ||
      config.filePathType === LogFormatType.FULL
    ) {
      // 使用标准格式
      const contextDisplay = contextPath ? `${contextPath}->` : "";

      if (config.lineTagPosition === "begin" && lineNumber) {
        logPrefix = `${lineNumber} ${filePathStr} ${contextDisplay}${placeholderVar}${config.varPilotSymbol}`;
      } else {
        logPrefix = `${filePathStr} ${contextDisplay}${placeholderVar}${config.varPilotSymbol}`;
        if (lineNumber) {
          logPrefix += ` ${lineNumber}`;
        }
      }
    }

    const value = new vscode.SnippetString(
      `${logMethod}(${config.quotationMark}${logPrefix}${
        config.quotationMark
      }, $1${getLogEnd(config)}`
    );
    editor.insertSnippet(value, varSelection.start);
    return;
  }

  // 选择了变量的情况
  const insertPosition = findValidInsertionPoint(document, varSelection, word);

  if (insertPosition) {
    const position = new vscode.Position(
      insertPosition.line,
      insertPosition.character
    );
    const insertSelection = new vscode.Selection(position, position);

    if (insertPosition.isEndOfStatement) {
      editor
        .edit((editBuilder) => {
          editBuilder.insert(position, "\n");
        })
        .then(() => {
          const newPosition = new vscode.Position(position.line + 1, 0);
          const newSelection = new vscode.Selection(newPosition, newPosition);
          const logStatement = generateLogStatement(
            document,
            varSelection,
            word,
            config,
            logMethod
          );

          editor
            .edit((editBuilder) => {
              editBuilder.insert(newPosition, logStatement);
            })
            .then(() => {
              // 计算插入后的语句结束位置并移动光标
              const endPosition = new vscode.Position(
                newPosition.line,
                newPosition.character + logStatement.length
              );
              editor.selection = new vscode.Selection(endPosition, endPosition);

              if (editor) {
                setTimeout(() => {
                  LogHighlighter.updateHighlights(editor);
                }, 100);
              }
            });
        });
    } else {
      vscode.commands
        .executeCommand("editor.action.insertLineAfter")
        .then(() => {
          const insertSection = editor.selection;
          const logStatement = generateLogStatement(
            document,
            varSelection,
            word,
            config,
            logMethod
          );

          editor
            .edit((editBuilder) => {
              editBuilder.insert(insertSection.start, logStatement);
            })
            .then(() => {
              // 计算插入位置的结束位置并移动光标
              const endPosition = new vscode.Position(
                insertSection.start.line,
                insertSection.start.character + logStatement.length
              );
              editor.selection = new vscode.Selection(endPosition, endPosition);

              if (editor) {
                setTimeout(() => {
                  LogHighlighter.updateHighlights(editor);
                }, 100);
              }
            });
        });
    }
  } else {
    vscode.commands.executeCommand("editor.action.insertLineAfter").then(() => {
      const insertSelection = editor.selection;
      const logStatement = generateLogStatement(
        document,
        insertSelection,
        word,
        config,
        logMethod
      );

      editor
        .edit((editBuilder) => {
          editBuilder.insert(insertSelection.start, logStatement);
        })
        .then(() => {
          // 计算插入位置的结束位置并移动光标
          const endPosition = new vscode.Position(
            insertSelection.start.line,
            insertSelection.start.character + logStatement.length
          );
          editor.selection = new vscode.Selection(endPosition, endPosition);

          if (editor) {
            setTimeout(() => {
              LogHighlighter.updateHighlights(editor);
            }, 100);
          }
        });
    });
  }
}
const quickLog = vscode.commands.registerTextEditorCommand(
  "log-rush.qlog",
  function () {
    insertConsoleLog(LogType.LOG);
  }
);
const quickError = vscode.commands.registerTextEditorCommand(
  "log-rush.qerror",
  function () {
    insertConsoleLog(LogType.ERROR);
  }
);
const quickWarn = vscode.commands.registerTextEditorCommand(
  "log-rush.qwarn",
  function () {
    insertConsoleLog(LogType.WARN);
  }
);
const quickInfo = vscode.commands.registerTextEditorCommand(
  "log-rush.qinfo",
  function () {
    insertConsoleLog(LogType.INFO);
  }
);
export { quickLog, quickError, quickWarn, quickInfo };
