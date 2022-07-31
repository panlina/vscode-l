import * as vscode from 'vscode';
import { Expression, Statement, programAt, Annotated, AnalyzedScope } from 'l';
import documentProgram from './documentProgram';
export function activateDefinition(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.languages.registerDefinitionProvider('l', {
			provideDefinition(document, position, token) {
				var program = documentProgram.get(document)!;
				var target = <Annotated<Expression | Statement>>programAt(program, document.offsetAt(position));
				if (target instanceof Expression.Name)
					if (target.environment) {
						var resolution = target.environment.resolve(target.identifier);
						if (resolution) {
							var [type, depth] = resolution;
							var scope = <AnalyzedScope>target.environment.ancestor(depth).scope;
							var source = scope.definition[target.identifier].node.source;
							return new vscode.Location(
								document.uri,
								new vscode.Range(
									document.positionAt(source.startIdx),
									document.positionAt(source.endIdx)
								)
							)
						}
					}
			}
		})
	);
};
