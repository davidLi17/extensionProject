import * as path from 'path';
import * as assert from 'assert';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';

function normalizePath(inputPath: string): string {
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
(() => {
    const mockDocument = {
        fileName: 'C:\\project\\src\\file.ts',
    } as vscode.TextDocument;

    const result = getFileInfo(mockDocument);

    assert.strictEqual(result.fileName, 'file.ts', 'Test Case 1: fileName should be file.ts');
    assert.strictEqual(result.fileDir, 'C:/project/src', 'Test Case 1: fileDir should be C:/project/src');
    assert.strictEqual(result.relativePath, 'src/file.ts', 'Test Case 1: relativePath should be src/file.ts');

    console.log('Test Case 1 Passed!'); // 可选的成功提示
})();
// 测试用例 2: 文件名中包含多个点
(() => {
    const mockDocument = {
        fileName: 'C:\\project\\src\\file.config.ts',
    } as vscode.TextDocument;

    const result = getFileInfo(mockDocument);

    assert.strictEqual(result.fileName, 'file.config.ts', 'Test Case 2: fileName should be file.config.ts');
    assert.strictEqual(result.fileDir, 'C:/project/src', 'Test Case 2: fileDir should be C:/project/src');
    assert.strictEqual(result.relativePath, 'src/file.config.ts', 'Test Case 2: relativePath should be src/file.config.ts');

    console.log('Test Case 2 Passed!'); // 可选的成功提示
})();