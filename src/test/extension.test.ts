import * as path from 'path';
import * as assert from 'assert';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';
import { describe,it,expect } from 'vitest';
export function normalizePath(inputPath: string): string {
    return inputPath.replace(/\\/g, '/');
    }
function getFileInfo(document: vscode.TextDocument) {
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
describe('getFileInfo', () => {
    it('should correctly extract file name, directory, and relative path', () => {
        const mockDocument = {
            fileName: 'C:\\project\\src\\file.ts',
        } as vscode.TextDocument;

        const result = getFileInfo(mockDocument);

        expect(result.fileName).toBe('file.ts');
        expect(result.fileDir).toBe('C:/project/src');
        expect(result.relativePath).toBe('src/file.ts');
    });

    it('should handle files with multiple dots in the name', () => {
        const mockDocument = {
            fileName: 'C:\\project\\src\\file.config.ts',
        } as vscode.TextDocument;

        const result = getFileInfo(mockDocument);

        expect(result.fileName).toBe('file.config.ts');
        expect(result.fileDir).toBe('C:/project/src');
        expect(result.relativePath).toBe('src/file.config.ts');
    });
});