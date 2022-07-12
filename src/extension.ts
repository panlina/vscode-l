import * as vscode from 'vscode';
import { activateDiagnostic } from './diagnostic';
import { activateHover } from './hover';

export function activate(context: vscode.ExtensionContext) {
	activateDiagnostic(context);
	activateHover(context);
}

export function deactivate() {}
