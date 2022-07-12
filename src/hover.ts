import * as vscode from 'vscode';
import { Environment, Scope, Expression, parse, programAt, analyze } from 'l';

export function activateHover(context: vscode.ExtensionContext) {
	vscode.languages.registerHoverProvider('l', {
		provideHover(document, position, token) {
			try { var program = parse(document.getText()); }
			catch (e) { return; }
			analyze(program, new Environment(new Scope({})));
			var target = programAt(program, document.offsetAt(position));
			if (target instanceof Expression && target.type == 'name')
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
