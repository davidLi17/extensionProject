import * as vscode from "vscode";
import * as path from "path";
import { findValidInsertionPoint } from "@/utils/codeAnalyzer";
import { LogConfig, LogFormatType, LogType } from "@/types/index";
import { LogHighlighter } from "@/utils/logHighlighter";
import { getEnclosingContextName } from "@/utils/codeAnalyzer/analyzers/contextAnalyzer";
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

// 构建日志前缀信息的接口
interface LogPrefixContext {
  fileName: string;
  relativePath: string;
  fullPath: string;
  lineNumber: string;
  functionName: string;
  objectName: string;
  contextPath: string;
  word: string;
}

// 提取公共的日志前缀构建逻辑
function buildLogPrefix(config: LogConfig, context: LogPrefixContext): string {
  const {
    fileName,
    relativePath,
    fullPath,
    lineNumber,
    functionName,
    objectName,
    contextPath,
    word,
  } = context;

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
        filePathStr = fullPath;
        break;
    }
  }

  let logPrefix = "";

  if (config.customFormat && config.filePathType === LogFormatType.CUSTOM) {
    // 使用自定义格式
    logPrefix = config.customFormat
      .replace("${fileName}", fileName)
      .replace("${filePath}", relativePath)
      .replace("${fullPath}", fullPath)
      .replace("${functionName}", functionName)
      .replace("${objectName}", objectName)
      .replace("${contextPath}", contextPath)
      .replace("${varName}", word)
      .replace("${lineNumber}", lineNumber)
      .replace("${varPilotSymbol}", config.varPilotSymbol);
  } else if (config.filePathType === LogFormatType.SHORT) {
    // SHORT 模式: console.log("varName::", varName);
    if (config.lineTagPosition === "begin" && lineNumber) {
      logPrefix = `${lineNumber} ${word}${config.varPilotSymbol}`;
    } else {
      logPrefix = `${word}${config.varPilotSymbol}`;
      if (lineNumber) {
        logPrefix += ` ${lineNumber}`;
      }
    }
  } else if (config.filePathType === LogFormatType.FULL) {
    // FULL 模式: console.log("path/file.ts contextPath varName::", varName);
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

  return logPrefix;
}

// 构建上下文路径
function buildContextPath(objectName: string, functionName: string): string {
  if (objectName && functionName) {
    return `${objectName}->${functionName}`;
  } else if (functionName) {
    return functionName;
  }
  return "";
}

function generateLogStatement(
  document: vscode.TextDocument,
  insertSection: vscode.Selection,
  word: string,
  config: LogConfig,
  logMethod: string = config.logMethod
): string {
  const { fileName, relativePath } = getFileInfo(document);
  const lineNumber = config.showLineNumber
    ? `l:${insertSection.end.line + 1}`
    : "";

  const contextInfo = getEnclosingContextName(document, insertSection.start);
  const functionName = contextInfo.functionName || "";
  const objectName = contextInfo.objectName || "";
  const contextPath = buildContextPath(objectName, functionName);

  const logPrefix = buildLogPrefix(config, {
    fileName,
    relativePath,
    fullPath: normalizePath(document.fileName),
    lineNumber,
    functionName,
    objectName,
    contextPath,
    word,
  });

  return `${logMethod}(${config.quotationMark}${logPrefix}${
    config.quotationMark
  }, ${word}${getLogEnd(config)}`;
}

function insertConsoleLog(logType: LogType) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const document = editor.document;
  const varSelection = editor.selection;
  const word = document.getText(varSelection);
  const config = getLogConfig();
  const logMethod = `console.${logType}`;

  // 没有选择变量的情况，使用带占位符的 snippet
  if (!word) {
    const { fileName, relativePath } = getFileInfo(document);
    const lineNumber = config.showLineNumber
      ? `l:${varSelection.end.line + 1}`
      : "";

    const contextInfo = getEnclosingContextName(document, varSelection.start);
    const functionName = contextInfo.functionName || "";
    const objectName = contextInfo.objectName || "";
    const contextPath = buildContextPath(objectName, functionName);

    // 使用占位符 $1 作为变量名
    const placeholderVar = "$1";
    const logPrefix = buildLogPrefix(config, {
      fileName,
      relativePath,
      fullPath: normalizePath(document.fileName),
      lineNumber,
      functionName,
      objectName,
      contextPath,
      word: placeholderVar,
    });

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
