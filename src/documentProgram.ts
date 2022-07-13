import * as vscode from 'vscode';
import { Expression, Statement } from 'l';
export default new Map<vscode.TextDocument, Expression | Statement[] | undefined>();
