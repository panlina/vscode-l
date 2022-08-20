import * as vscode from 'vscode';
import { Expression, Statement, programAt, Annotated } from 'l';
import documentProgram from './documentProgram';
export function activateDefinition(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.languages.registerDefinitionProvider('l', {
			provideDefinition(document, position, token) {
				var program = documentProgram.get(document)!;
				var target = <Annotated<Expression | Statement>>programAt(program, document.offsetAt(position));
				if (target instanceof Expression.Name)
					if (target.definition) {
						var definition = <Annotated<Expression.Name>>target.definition;
						var source = definition.node.source;
						return new vscode.Location(
							document.uri,
							new vscode.Range(
								document.positionAt(source.startIdx),
								document.positionAt(source.endIdx)
							)
						)
					}
			}
		})
	);
};
