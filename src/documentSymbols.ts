import * as vscode from 'vscode';
import { Expression, Annotated, traverse } from 'l';
import documentProgram from './documentProgram';
export function activateDocumentSymbols(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.languages.registerDocumentSymbolProvider('l', {
			provideDocumentSymbols(document, token) {
				var program = documentProgram.get(document)!;
				var symbols: vscode.DocumentSymbol[] = [];
				for (var p of traverse(program))
					if (p instanceof Expression.Name)
						if (!('definition' in p)) {
							var source = (<Annotated<Expression.Name>>p).node.source;
							symbols.push(new vscode.DocumentSymbol(
								p.identifier,
								"",
								vscode.SymbolKind.Variable,
								new vscode.Range(
									document.positionAt(source.startIdx),
									document.positionAt(source.endIdx)
								),
								new vscode.Range(
									document.positionAt(source.startIdx),
									document.positionAt(source.endIdx)
								)
							));
						}
				return symbols;
			}
		})
	);
}
