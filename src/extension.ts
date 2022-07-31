import * as vscode from 'vscode';
import { activateDiagnostic } from './diagnostic';
import { activateHover } from './hover';
import { activateDefinition } from './definition';

export function activate(context: vscode.ExtensionContext) {
	activateDiagnostic(context);
	activateHover(context);
	activateDefinition(context);
}

export function deactivate() {}
