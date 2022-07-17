import * as vscode from 'vscode';
import { Expression, programAt } from 'l';
import documentProgram from './documentProgram';

export function activateHover(context: vscode.ExtensionContext) {
	vscode.languages.registerHoverProvider('l', {
		provideHover(document, position, token) {
			var program = documentProgram.get(document)!;
			var target = programAt(program, document.offsetAt(position));
			if (target instanceof Expression.Name)
				if (target.environment) {
					var resolution = target.environment.resolve(target.identifier);
					if (resolution)
						return {
							contents: [
								`local: ${target.identifier}`
							]
						};
				}
		}
	});
};
