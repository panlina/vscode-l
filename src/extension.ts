import * as vscode from 'vscode';
import { activateDiagnostic } from './diagnostic';
import { activateHover } from './hover';
import { activateDefinition } from './definition';
import { activateReferences } from './references';
import { activateDocumentHighlights } from './documentHighlights';

export function activate(context: vscode.ExtensionContext) {
	activateDiagnostic(context);
	activateHover(context);
	activateDefinition(context);
	activateReferences(context);
	activateDocumentHighlights(context);
}

export function deactivate() {}
