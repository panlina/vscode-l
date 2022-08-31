import * as vscode from 'vscode';
import { Expression, Statement, programAt, Annotated } from 'l';
import documentProgram from './documentProgram';

export function activateHover(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.languages.registerHoverProvider('l', {
			provideHover(document, position, token) {
				var program = documentProgram.get(document)!;
				var target = <Annotated<Expression | Statement>>programAt(program, document.offsetAt(position));
				if (target instanceof Expression.Name) {
					var definition = 'definition' in target ? <Annotated<Expression.Name>>target.definition : target;
					if (!definition) return;
					var type: "variable" | "label" =
						definition.parent instanceof Statement.Var ? 'variable' : 'label';
					return {
						contents: [
							`${type}: ${target.identifier}`
						]
					};
				}
			}
		})
	);
}
