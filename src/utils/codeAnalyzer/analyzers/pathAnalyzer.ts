import { NodePath } from "@babel/traverse";
import * as babelTypes from "@babel/types";
import { Logger } from "../core/logger";

/**
 * 构建节点路径层次，优化版本
 * 主要用于获取函数调用的完整路径，特别是处理嵌套对象和类方法
 * @param path 节点路径
 * @returns 路径字符串数组，例如 ["outer", "inner", "deepMethod"]
 */
export function buildPathHierarchy(path: NodePath): string[] {
  const result: string[] = [];
  Logger.trace(`开始构建路径层次，节点类型: ${path.node.type}`);

  // 处理对象方法特殊情况
  if (
    babelTypes.isObjectMethod(path.node) &&
    babelTypes.isIdentifier(path.node.key)
  ) {
    return buildObjectMethodPath(path);
  }

  // 处理类方法特殊情况
  if (
    babelTypes.isClassMethod(path.node) &&
    babelTypes.isIdentifier(path.node.key)
  ) {
    return buildClassMethodPath(path);
  }

  // 通用情况处理
  let current: NodePath | null = path;
  const visitedPaths = new Set<NodePath>(); // 避免循环引用

  while (current && !visitedPaths.has(current)) {
    visitedPaths.add(current);

    // 处理函数声明/表达式
    if (
      (babelTypes.isFunctionDeclaration(current.node) ||
        babelTypes.isFunctionExpression(current.node)) &&
      current.node.id &&
      babelTypes.isIdentifier(current.node.id)
    ) {
      result.unshift(current.node.id.name);
      Logger.trace(`添加函数名: ${current.node.id.name}`);
      break;
    }

    // 处理箭头函数
    else if (
      babelTypes.isArrowFunctionExpression(current.node) &&
      current.parent &&
      babelTypes.isVariableDeclarator(current.parent)
    ) {
      if (babelTypes.isIdentifier(current.parent.id)) {
        result.unshift(current.parent.id.name);
        Logger.trace(`添加箭头函数变量名: ${current.parent.id.name}`);
      }
      break;
    }

    current = current.parentPath;
  }

  if (result.length > 0) {
    Logger.debug(`构建路径结果: ${result.join(".")}`);
  } else {
    Logger.debug("路径构建结果为空");
  }
  return result;
}

/**
 * 专门用于构建对象方法的路径
 * 处理多级嵌套对象的情况
 */
export function buildObjectMethodPath(path: NodePath): string[] {
  const result: string[] = [];
  const visitedPaths = new Set<NodePath>();

  // 添加方法名
  if (
    babelTypes.isObjectMethod(path.node) &&
    babelTypes.isIdentifier(path.node.key)
  ) {
    result.unshift(path.node.key.name);
    Logger.trace(`添加对象方法名: ${path.node.key.name}`);
  }

  // 向上查找，构建对象路径
  let current = path.parentPath;

  // 首先找到对象表达式
  while (
    current &&
    !babelTypes.isObjectExpression(current.node) &&
    !visitedPaths.has(current)
  ) {
    visitedPaths.add(current);
    current = current.parentPath;
  }

  // 如果找到了对象表达式，继续向上找对象名
  if (current) {
    let objPath = current;
    let depth = 0;

    while (objPath && depth < 10) {
      // 限制深度防止无限循环
      // eslint-disable-next-line curly
      if (visitedPaths.has(objPath)) break;
      visitedPaths.add(objPath);
      depth++;

      let parentPath = objPath.parentPath;
      // eslint-disable-next-line curly
      if (!parentPath) break;

      // 直接变量声明的对象：const obj = { method() {} }
      if (
        babelTypes.isVariableDeclarator(parentPath.node) &&
        babelTypes.isIdentifier(parentPath.node.id)
      ) {
        result.unshift(parentPath.node.id.name);
        Logger.trace(`添加顶层对象名: ${parentPath.node.id.name}`);
        break;
      }

      // 嵌套在另一个对象里：const obj = { inner: { method() {} } }
      else if (
        babelTypes.isObjectProperty(parentPath.node) &&
        babelTypes.isIdentifier(parentPath.node.key)
      ) {
        result.unshift(parentPath.node.key.name);
        Logger.trace(`添加嵌套对象属性名: ${parentPath.node.key.name}`);

        // 继续向上寻找，可能还有更上层的嵌套
        //@ts-ignore
        objPath = parentPath.parentPath;

        // 如果父级是对象表达式，我们需要再上一级
        if (objPath && babelTypes.isObjectExpression(objPath.node)) {
          continue;
        }
      } else {
        break;
      }
    }
  }

  if (result.length > 0) {
    Logger.debug(`对象方法路径: ${result.join(".")}`);
  }

  return result;
}

/**
 * 专门用于构建类方法的路径
 */
export function buildClassMethodPath(path: NodePath): string[] {
  const result: string[] = [];

  // 添加方法名
  if (
    babelTypes.isClassMethod(path.node) &&
    babelTypes.isIdentifier(path.node.key)
  ) {
    result.unshift(path.node.key.name);
    Logger.trace(`添加类方法名: ${path.node.key.name}`);
  }

  // 查找类声明
  const classPath = path.findParent((p) =>
    babelTypes.isClassDeclaration(p.node)
  );
  if (
    classPath &&
    babelTypes.isClassDeclaration(classPath.node) &&
    classPath.node.id
  ) {
    result.unshift(classPath.node.id.name);
    Logger.trace(`添加类名: ${classPath.node.id.name}`);
  }

  return result;
}
