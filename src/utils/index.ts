import * as vscode from "vscode";

export class VSCodeHelper {

    // 显示信息消息
    static showInfoMessage(msg: string): void {
        vscode.window.showInformationMessage(msg);
    }

    // 显示警告消息
    static showWarningMessage(msg: string): void {
        vscode.window.showWarningMessage(msg);
    }

    // 显示错误消息
    static showErrorMessage(msg: string): void {
        vscode.window.showErrorMessage(msg);
    }

    // 显示选择框
    static showQuickPick(options: string[]): Thenable<string | undefined> {
        return vscode.window.showQuickPick(options, { placeHolder: "请选择一个选项" });
    }

    // 显示输入框
    static showInputBox(placeHolder: string): Thenable<string | undefined> {
        return vscode.window.showInputBox({ placeHolder });
    }

    // 显示确认框
    static showConfirmDialog(message: string): Thenable<boolean> {
        return vscode.window.showInformationMessage(message, "确认", "取消")
            .then(selection => selection === "确认");
    }

    // 显示进度条
    static showProgress(title: string, task: () => Promise<void>): void {
        vscode.window.withProgress(
            { location: vscode.ProgressLocation.Window, title },
            async (progress) => {
                await task();
            }
        );
    }

    // 打开文件
    static openFile(filePath: string): void {
        vscode.workspace.openTextDocument(filePath).then(doc => {
            vscode.window.showTextDocument(doc);
        });
    }

    // 保存文件
    static saveFile(doc: vscode.TextDocument): Thenable<boolean> {
        return doc.save();
    }
}
