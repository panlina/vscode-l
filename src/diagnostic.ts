import * as vscode from 'vscode';
import { parse } from 'l';

export function activateDiagnostic(context: vscode.ExtensionContext) {
	const diagnostics = vscode.languages.createDiagnosticCollection('l');
	context.subscriptions.push(diagnostics);

	var activeTextEditor = vscode.window.activeTextEditor;
	if (activeTextEditor)
		if (activeTextEditor.document.languageId == 'l')
			diagnose(activeTextEditor.document);
	vscode.workspace.onDidOpenTextDocument(document => {
		if (document.languageId == 'l')
			diagnose(document);
	});
	vscode.workspace.onDidChangeTextDocument(e => {
		if (e.document.languageId == 'l')
			if (e.contentChanges.length)
				diagnose(e.document);
	});
	vscode.workspace.onDidCloseTextDocument(document => {
		if (document.languageId == 'l')
			diagnostics.delete(document.uri);
	});

	function diagnose(document: vscode.TextDocument) {
		try { var program = parse(document.getText()); }
		catch (e) { var error = e; }
		if (program)
			diagnostics.set(document.uri, []);
		else {
			var [, line, col, message] = error.matchResult.shortMessage.match(/^Line (\d+), col (\d+): (.*)$/);
			var line = +line, col = +col;
			var position = new vscode.Position(line - 1, col - 1);
			var diagnostic = new vscode.Diagnostic(
				new vscode.Range(position, position.translate(undefined, 1)),
				message,
				vscode.DiagnosticSeverity.Error
			);
			diagnostics.set(document.uri, [diagnostic]);
		}
	}
};
