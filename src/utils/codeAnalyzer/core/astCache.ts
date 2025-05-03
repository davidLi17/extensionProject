import { ScopeInfo } from "../types";
import { Logger } from "./logger";
import { buildScopeTree, parseCode } from "./parser";
// 添加缓存机制
export class AstCache {
  private static astMap = new Map<string, any>();
  private static scopeMap = new Map<string, ScopeInfo>();
  private static contentChecksums = new Map<string, number>();

  // 简单的内容哈希函数，用于检测文件内容变化
  private static checksum(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash; // 转换为32位整数
    }
    return hash;
  }

  static getAst(code: string, fileName: string): any {
    // 使用文件名和内容哈希作为缓存键
    const checksum = this.checksum(code);
    const key = `${fileName}:${checksum}`;

    // 如果哈希匹配，直接返回缓存的AST
    if (
      this.contentChecksums.get(fileName) === checksum &&
      this.astMap.has(key)
    ) {
      Logger.debug(`使用缓存的AST: ${fileName}`);
      return this.astMap.get(key);
    }

    // 更新内容哈希
    this.contentChecksums.set(fileName, checksum);

    // 解析并缓存
    Logger.info(`解析文件AST: ${fileName}`);
    const ast = parseCode(code, fileName);
    this.astMap.set(key, ast);
    return ast;
  }

  static getScopeTree(code: string, fileName: string): ScopeInfo {
    // 使用文件名和内容哈希作为缓存键
    const checksum = this.checksum(code);
    const key = `${fileName}:${checksum}`;

    // 如果哈希匹配，直接返回缓存的作用域树
    if (
      this.contentChecksums.get(fileName) === checksum &&
      this.scopeMap.has(key)
    ) {
      Logger.debug(`使用缓存的作用域树: ${fileName}`);
      return this.scopeMap.get(key)!;
    }

    // 更新内容哈希
    this.contentChecksums.set(fileName, checksum);

    // 重建作用域树并缓存
    Logger.info(`构建文件作用域树: ${fileName}`);
    const ast = this.getAst(code, fileName);
    const scope = buildScopeTree(ast);
    this.scopeMap.set(key, scope);
    return scope;
  }

  static clearCache(fileName?: string) {
    if (fileName) {
      // 清除指定文件的缓存
      Logger.info(`清除文件缓存: ${fileName}`);
      for (const key of this.astMap.keys()) {
        if (key.startsWith(`${fileName}:`)) {
          this.astMap.delete(key);
          this.scopeMap.delete(key);
          this.contentChecksums.delete(fileName);
        }
      }
    } else {
      // 清除所有缓存
      Logger.info("清除所有缓存");
      this.astMap.clear();
      this.scopeMap.clear();
      this.contentChecksums.clear();
    }
  }
}
