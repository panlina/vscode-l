import * as vscode from 'vscode';
import { Program } from 'l';
export default new Map<vscode.TextDocument, Program | undefined>();
