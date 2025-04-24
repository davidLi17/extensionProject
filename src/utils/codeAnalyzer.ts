// 导入VSCode API模块，用于与VSCode编辑器交互
import * as vscode from "vscode";
// 导入Babel解析器模块，用于将代码解析为抽象语法树(AST)
import * as parser from "@babel/parser";
// 导入Babel遍历器模块，用于遍历AST，NodePath是遍历时的节点路径类型
import traverse, { NodePath } from "@babel/traverse";
// 导入Babel类型模块，提供AST节点的类型判断方法
import * as babelTypes from "@babel/types";

// 定义插入位置的数据结构接口
interface InsertionPosition {
  line: number; // 插入位置的行号
  character: number; // 插入位置的字符偏移量
  isEndOfStatement: boolean; // 标识是否在语句末尾插入
}

// 定义上下文信息的返回接口
export interface ContextInfo {
  functionName: string | null; // 函数名称，可能为null
  objectName: string | null; // 对象名称，可能为null
}

// 获取包含指定位置的函数名和对象名
export function getEnclosingContextName(
  document: vscode.TextDocument, // VSCode文档对象
  position: vscode.Position // 文档中的位置
): ContextInfo {
  // 获取文档全部文本内容
  const code = document.getText();
  // 将位置转换为文档中的字符偏移量
  const offset = document.offsetAt(position);

  // 初始化返回的函数名和对象名
  let functionName: string | null = null;
  let objectName: string | null = null;

  try {
    // 根据文件扩展名确定源代码类型
    const sourceType: "module" | "script" | "unambiguous" =
      document.fileName.endsWith(".tsx") || document.fileName.endsWith(".jsx")
        ? "script" // 如果是React文件，使用script模式
        : "module"; // 否则使用module模式

    // 使用Babel解析器解析代码为AST
    const ast = parser.parse(code, {
      sourceType: sourceType,
      // 启用TypeScript、JSX等语法插件
      plugins: ["typescript", "jsx", "decorators-legacy", "classProperties"],
    });

    // 遍历AST查找包含指定位置的节点
    traverse(ast, {
      enter(path) {
        const node = path.node;

        // 跳过没有位置信息或无效位置的节点
        if (
          !node.loc ||
          typeof node.start !== "number" ||
          typeof node.end !== "number"
        ) {
          return;
        }

        // 检查当前节点是否包含指定位置
        if (offset >= node.start && offset <= node.end) {
          // 处理函数声明
          if (babelTypes.isFunctionDeclaration(node) && node.id) {
            functionName = node.id.name;
          }
          // 处理函数表达式
          else if (
            babelTypes.isFunctionExpression(node) &&
            path.parent &&
            babelTypes.isVariableDeclarator(path.parent) &&
            path.parent.id &&
            babelTypes.isIdentifier(path.parent.id)
          ) {
            functionName = path.parent.id.name;
          }
          // 处理箭头函数
          else if (
            babelTypes.isArrowFunctionExpression(node) &&
            path.parent &&
            babelTypes.isVariableDeclarator(path.parent) &&
            path.parent.id &&
            babelTypes.isIdentifier(path.parent.id)
          ) {
            functionName = path.parent.id.name;
          }
          // 处理对象方法
          else if (
            babelTypes.isObjectMethod(node) &&
            node.key &&
            babelTypes.isIdentifier(node.key)
          ) {
            functionName = node.key.name;

            // 向上查找对象表达式
            let parent = path.parentPath;
            while (parent && !babelTypes.isObjectExpression(parent.node)) {
              parent = parent.parentPath;
            }

            // 如果找到对象表达式且其父节点是变量声明
            if (
              parent &&
              parent.parent &&
              babelTypes.isVariableDeclarator(parent.parent) &&
              parent.parent.id &&
              babelTypes.isIdentifier(parent.parent.id)
            ) {
              objectName = parent.parent.id.name;
            }
          }
          // 处理类方法
          else if (
            babelTypes.isClassMethod(node) &&
            node.key &&
            babelTypes.isIdentifier(node.key)
          ) {
            functionName = node.key.name;

            // 向上查找类声明
            const classPath = path.findParent((p) =>
              babelTypes.isClassDeclaration(p.node)
            );
            // 如果找到类声明且有类名
            if (
              classPath &&
              babelTypes.isClassDeclaration(classPath.node) &&
              classPath.node.id
            ) {
              objectName = classPath.node.id.name;
            }
          }
        }
      },
    });

    // 返回找到的函数名和对象名
    return { functionName, objectName };
  } catch (e) {
    // 解析出错时打印错误并返回空值
    console.error("解析错误:", e);
    return { functionName: null, objectName: null };
  }
}

// 查找有效的代码插入点
export function findValidInsertionPoint(
  document: vscode.TextDocument, // VSCode文档对象
  selection: vscode.Selection, // 用户选择的文本范围
  variableName: string // 变量名
): InsertionPosition | null {
  // 获取文档全部文本内容
  const code = document.getText();

  // 使用Babel解析器解析代码为AST
  let ast;
  try {
    // 根据文件扩展名确定源代码类型
    const sourceType: "module" | "script" | "unambiguous" =
      document.fileName.endsWith(".tsx") || document.fileName.endsWith(".jsx")
        ? "script" // 如果是React文件，使用script模式
        : "module"; // 否则使用module模式

    ast = parser.parse(code, {
      sourceType: sourceType,
      // 启用TypeScript、JSX等语法插件
      plugins: ["typescript", "jsx", "decorators-legacy", "classProperties"],
    });
  } catch (e) {
    // 解析出错时打印错误并返回空值
    console.error("解析错误:", e);
    return null;
  }

  // 将选择开始位置转换为文档偏移量
  const selectedPosition = document.offsetAt(selection.start);

  // 初始化有效插入位置
  let validPosition: InsertionPosition | null = null;
  // 当前包含选中位置的节点
  let enclosingNode: any = null;
  // 记录最后一条语句的结束位置
  let lastStatementEnd = 0;
  // 跟踪方法体内的语句
  let methodBodyStatements: any[] = [];
  // 是否在方法体内的标志
  let inMethodBody = false;
  // 当前方法体节点
  let currentMethodBodyNode: any = null;

  // 遍历AST查找插入位置
  traverse(ast, {
    enter(path) {
      const node = path.node;

      // 跳过没有位置信息的节点
      if (!node.loc) {
        return;
      }

      // 检查是否进入方法体
      if (
        (babelTypes.isObjectMethod(path.parent) ||
          babelTypes.isClassMethod(path.parent)) &&
        babelTypes.isBlockStatement(node)
      ) {
        inMethodBody = true;
        currentMethodBodyNode = node;
        methodBodyStatements = [];
      }

      // 检查当前节点是否包含选中位置
      if (
        typeof node.start === "number" &&
        typeof node.end === "number" &&
        selectedPosition >= node.start &&
        selectedPosition <= node.end
      ) {
        enclosingNode = node;

        // 如果是变量声明或表达式语句，更新最后语句结束位置
        if (
          (babelTypes.isVariableDeclaration(node) ||
            babelTypes.isExpressionStatement(node)) &&
          node.end > lastStatementEnd
        ) {
          lastStatementEnd = node.end;

          // 如果在方法体内，记录该语句
          if (inMethodBody && currentMethodBodyNode) {
            methodBodyStatements.push(node);
          }
        }
      }
    },
    exit(path) {
      const node = path.node;

      // 如果退出方法体，重置相关标志
      if (
        (babelTypes.isObjectMethod(path.parent) ||
          babelTypes.isClassMethod(path.parent)) &&
        babelTypes.isBlockStatement(node)
      ) {
        inMethodBody = false;
        currentMethodBodyNode = null;
      }

      // 处理方法体内的语句
      if (
        enclosingNode &&
        methodBodyStatements.length > 0 &&
        methodBodyStatements.some(
          (stmt) =>
            stmt.start <= enclosingNode.start && stmt.end >= enclosingNode.end
        )
      ) {
        // 找到包含选中变量的语句
        const containingStatement = methodBodyStatements.find(
          (stmt) =>
            stmt.start <= enclosingNode.start && stmt.end >= enclosingNode.end
        );

        if (containingStatement) {
          // 在该语句后插入
          const insertPosition = document.positionAt(containingStatement.end);
          validPosition = {
            line: insertPosition.line,
            character: insertPosition.character,
            isEndOfStatement: true,
          };
          return;
        }
      }

      // 处理块级语句
      if (
        (babelTypes.isBlockStatement(node) ||
          babelTypes.isVariableDeclaration(node) ||
          babelTypes.isExpressionStatement(node)) &&
        enclosingNode &&
        typeof node.start === "number" &&
        typeof enclosingNode.start === "number" &&
        typeof node.end === "number" &&
        node.start <= enclosingNode.start &&
        node.end >= enclosingNode.end
      ) {
        // 检查是否是方法体
        const isMethodBody =
          babelTypes.isBlockStatement(node) &&
          (babelTypes.isObjectMethod(path.parent) ||
            babelTypes.isClassMethod(path.parent));

        // 如果还没有找到有效位置
        if (!validPosition) {
          // 确定插入位置
          const insertPosition = document.positionAt(
            lastStatementEnd > 0 ? lastStatementEnd : enclosingNode.end
          );
          validPosition = {
            line: insertPosition.line,
            character: insertPosition.character,
            isEndOfStatement: true,
          };
        }
      }

      // 特殊处理对象属性
      if (
        babelTypes.isObjectProperty(node) &&
        typeof node.start === "number" &&
        typeof node.end === "number" &&
        node.start <= selectedPosition &&
        node.end >= selectedPosition
      ) {
        // 向上查找对象表达式
        let currentPath = path;
        while (
          currentPath &&
          !babelTypes.isObjectExpression(currentPath.node)
        ) {
          const parent = currentPath.parentPath;
          if (!parent) {
            break;
          }
          currentPath = parent;
        }

        // 如果找到对象表达式
        if (
          currentPath &&
          babelTypes.isObjectExpression(currentPath.node) &&
          typeof currentPath.node.end === "number"
        ) {
          const objEnd = document.positionAt(currentPath.node.end);

          // 向上查找变量声明或表达式语句
          let statementPath = currentPath;
          while (
            statementPath &&
            statementPath.parentPath &&
            !babelTypes.isVariableDeclaration(statementPath.node) &&
            !babelTypes.isExpressionStatement(statementPath.node)
          ) {
            statementPath = statementPath.parentPath;
          }

          // 如果找到语句节点
          if (statementPath && typeof statementPath.node.end === "number") {
            const stmtEnd = document.positionAt(statementPath.node.end);
            validPosition = {
              line: stmtEnd.line,
              character: stmtEnd.character,
              isEndOfStatement: true,
            };
          }
        }
      }

      // 特殊处理对象方法
      if (
        babelTypes.isObjectMethod(node) &&
        enclosingNode &&
        typeof node.body === "object" &&
        node.body &&
        typeof node.body.start === "number" &&
        typeof node.body.end === "number" &&
        node.body.start <= selectedPosition &&
        node.body.end >= selectedPosition
      ) {
        // 在方法体内查找包含选中位置的语句
        const methodStatements = (node.body as any).body || [];
        for (const stmt of methodStatements) {
          if (
            typeof stmt.start === "number" &&
            typeof stmt.end === "number" &&
            stmt.start <= selectedPosition &&
            stmt.end >= selectedPosition
          ) {
            // 在该语句后插入
            const insertPosition = document.positionAt(stmt.end);
            validPosition = {
              line: insertPosition.line,
              character: insertPosition.character,
              isEndOfStatement: true,
            };
            break;
          }
        }
      }
    },
  });

  // 如果没有找到合适的位置，回退到行末
  if (!validPosition) {
    const line = document.lineAt(selection.end.line);
    validPosition = {
      line: selection.end.line,
      character: line.text.length,
      isEndOfStatement: false,
    };
  }

  return validPosition;
}
