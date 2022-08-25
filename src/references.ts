import * as vscode from 'vscode';
import { Expression, Statement, programAt, Annotated, findReferences } from 'l';
import documentProgram from './documentProgram';
export function activateReferences(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.languages.registerReferenceProvider('l', {
			provideReferences(document, position, context, token) {
				var program = documentProgram.get(document)!;
				var target = <Annotated<Expression | Statement>>programAt(program, document.offsetAt(position));
				if (target instanceof Expression.Name) {
					var definition = target.definition || target;
					var references = [...findReferences(definition)];
					return references.map(reference => {
						var source = (<Annotated<Expression.Name>>reference).node.source;
						return new vscode.Location(
							document.uri,
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
};
