import * as vscode from 'vscode';
import { Expression, Statement, programAt, Annotated, findReferences } from 'l';
import documentProgram from './documentProgram';
export function activateDocumentHighlights(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.languages.registerDocumentHighlightProvider('l', {
			provideDocumentHighlights(document, position, token) {
				var program = documentProgram.get(document)!;
				var target = <Annotated<Expression | Statement>>programAt(program, document.offsetAt(position));
				if (target instanceof Expression.Name) {
					var definition = target.definition || target;
					var references = [...findReferences(definition)];
					return [definition, ...references].map(reference => {
						var source = (<Annotated<Expression.Name>>reference).node.source;
						return new vscode.DocumentHighlight(
							new vscode.Range(
								document.positionAt(source.startIdx),
								document.positionAt(source.endIdx)
							)
						);
					});
				}
			}
		})
	);
}
