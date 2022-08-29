import * as vscode from 'vscode';
import { Expression, Statement, programAt, Annotated } from 'l';
import documentProgram from './documentProgram';

export function activateHover(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.languages.registerHoverProvider('l', {
			provideHover(document, position, token) {
				var program = documentProgram.get(document)!;
				var target = <Annotated<Expression | Statement>>programAt(program, document.offsetAt(position));
				if (target instanceof Expression.Name)
					if (target.environment) {
						var resolution = target.environment.resolve(target.identifier);
						if (resolution) {
							var [type, depth] = resolution;
							return {
								contents: [
									`${type}: ${target.identifier}`
								]
							};
						}
					}
			}
		})
	);
}
