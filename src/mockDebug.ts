/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
/*
 * mockDebug.ts implements the Debug Adapter that "adapts" or translates the Debug Adapter Protocol (DAP) used by the client (e.g. VS Code)
 * into requests and events of the real "execution engine" or "debugger" (here: class MockRuntime).
 * When implementing your own debugger extension for VS Code, most of the work will go into the Debug Adapter.
 * Since the Debug Adapter is independent from VS Code, it can be used in any client (IDE) supporting the Debug Adapter Protocol.
 *
 * The most important class of the Debug Adapter is the MockDebugSession which implements many DAP requests by talking to the MockRuntime.
 */

import { promises as fs } from 'fs';
import {
	Logger, logger,
	LoggingDebugSession,
	InitializedEvent, TerminatedEvent, StoppedEvent,
	Thread, StackFrame, Scope as DAPScope, Source, Handles
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { basename } from 'path-browserify';
import { Subject } from 'await-notify';
import { Machine, Environment, Scope, Expression, Annotated, parse, Statement, Value } from "l";

/**
 * This interface describes the mock-debug specific launch attributes
 * (which are not part of the Debug Adapter Protocol).
 * The schema for these attributes lives in the package.json of the mock-debug extension.
 * The interface should always match this schema.
 */
interface ILaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	/** An absolute path to the "program" to debug. */
	program: string;
	/** Automatically stop target after launch. If not specified, target does not stop. */
	stopOnEntry?: boolean;
	/** enable logging the Debug Adapter Protocol */
	trace?: boolean;
	/** run without debugging */
	noDebug?: boolean;
	/** if specified, results in a simulated compile error in launch. */
	compileError?: 'default' | 'show' | 'hide';
}

interface IAttachRequestArguments extends ILaunchRequestArguments { }


export class MockDebugSession extends LoggingDebugSession {

	// we don't support multiple threads, so we can use a hardcoded ID for the default thread
	private static threadID = 1;

	private machine: Machine;
	private source?: string;

	private _variableHandles = new Handles<Scope<Value> | Value | Environment<Value>>();

	private _configurationDone = new Subject();

	/**
	 * Creates a new debug adapter that is used for one debug session.
	 * We configure the default implementation of a debug adapter here.
	 */
	public constructor() {
		super("mock-debug.txt");

		// this debugger uses zero-based lines and columns
		this.setDebuggerLinesStartAt1(false);
		this.setDebuggerColumnsStartAt1(false);

		this.machine = new Machine(new Environment(new Scope({})));
	}

	/**
	 * The 'initialize' request is the first request called by the frontend
	 * to interrogate the features the debug adapter provides.
	 */
	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {

		// build and return the capabilities of this debug adapter:
		response.body = response.body || {};

		// the adapter implements the configurationDone request.
		response.body.supportsConfigurationDoneRequest = true;

		this.sendResponse(response);

		// since this debug adapter can accept configuration requests like 'setBreakpoint' at any time,
		// we request them early by sending an 'initializeRequest' to the frontend.
		// The frontend will end the configuration sequence by calling 'configurationDone' request.
		this.sendEvent(new InitializedEvent());
	}

	/**
	 * Called at the end of the configuration sequence.
	 * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
	 */
	protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
		super.configurationDoneRequest(response, args);

		// notify the launchRequest that configuration has finished
		this._configurationDone.notify();
	}

	protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request): void {
		console.log(`disconnectRequest suspend: ${args.suspendDebuggee}, terminate: ${args.terminateDebuggee}`);
	}

	protected async attachRequest(response: DebugProtocol.AttachResponse, args: IAttachRequestArguments) {
		return this.launchRequest(response, args);
	}

	protected async launchRequest(response: DebugProtocol.LaunchResponse, args: ILaunchRequestArguments) {

		// make sure to 'Stop' the buffered logging if 'trace' is not set
		logger.setup(args.trace ? Logger.LogLevel.Verbose : Logger.LogLevel.Stop, false);

		// wait 1 second until configuration has finished (and configurationDoneRequest has been called)
		await this._configurationDone.wait(1000);

		// start the program in the runtime
		this.source = args.program;
		var program = parse(await fs.readFile(this.source!, 'utf8'));
		this.machine.run(program);
		if (!args.noDebug) {
			if (args.stopOnEntry) {
				if (!this.machine.step())
					this.sendEvent(new StoppedEvent('entry', MockDebugSession.threadID));
				else
					this.sendEvent(new TerminatedEvent());
			} else {
				// we just start to run until we hit a breakpoint, an exception, or the end of the program
				while (!this.machine.step());
				this.sendEvent(new TerminatedEvent());
			}
		} else {
			while (!this.machine.step());
			this.sendEvent(new TerminatedEvent());
		}

		if (args.compileError) {
			// simulate a compile/build error in "launch" request:
			// the error should not result in a modal dialog since 'showUser' is set to false.
			// A missing 'showUser' should result in a modal dialog.
			this.sendErrorResponse(response, {
				id: 1001,
				format: `compile error: some fake error.`,
				showUser: args.compileError === 'show' ? true : (args.compileError === 'hide' ? false : undefined)
			});
		} else {
			this.sendResponse(response);
		}
	}

	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {

		// runtime supports no threads so just return a default thread.
		response.body = {
			threads: [
				new Thread(MockDebugSession.threadID, "thread 1"),
			]
		};
		this.sendResponse(response);
	}

	protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
		response.body = {
			stackFrames: this.machine.callStack.map(({ current: program }, i) => {
				var [, line, col] = (<Annotated<Expression | Statement>>program).node.source.getLineAndColumnMessage().match(/^Line (\d+), col (\d+):/)!;
				return new StackFrame(
					i, `(function)`, this.createSource(this.source!), +line, +col
				);
			}),
			totalFrames: this.machine.callStack.length
		};
		this.sendResponse(response);
	}

	protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {

		var environment = this.machine.callStack[args.frameId].environment;
		var scopes: DAPScope[] = [];
		for (var scope of environment)
			scopes.push(new DAPScope('Locals', this._variableHandles.create(scope), false));
		response.body = {
			scopes: scopes
		};
		this.sendResponse(response);
	}

	protected async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request): Promise<void> {

		var variables: [string, Value | Scope<Value> | Environment<Value>][];
		var variable = this._variableHandles.get(args.variablesReference);
		if (variable instanceof Scope<Value>) {
			var scope = variable;
			var variables = Object.entries(scope.name) as typeof variables;
		} else if (variable instanceof Environment<Value>) {
			var environment = variable;
			var scopes: Scope<Value>[] = [...environment];
			var variables = scopes.map(
				(scope, i) => [i.toString(), scope] as [string, Scope<Value>]
			) as typeof variables;
		} else {
			var value = variable;
			switch (value.type) {
				case 'array':
					var variables = (<Value.Array>value).element.map(
						(element, i) => [i.toString(), element]
					) as typeof variables;
					break;
				case 'tuple':
					var variables = (<Value.Tuple>value).element.map(
						(element, i) => [i.toString(), element]
					) as typeof variables;
					break;
				case 'object':
					var variables = Object.entries((<Value.Object>value).property).map(
						([name, value]) => [name, value]
					) as typeof variables;
					break;
				case 'function':
					var variables = [
						['[[environment]]', (<Value.Function>value).environment]
					] as typeof variables;
					break;
				default:
					var variables: typeof variables = [];
			}
		}

		response.body = {
			variables: variables.map(([name, value]) => ({
				name: name,
				value: this.renderValue(value),
				variablesReference:
					(value instanceof Environment<Value>)
					||
					(value instanceof Scope<Value>)
					||
					['array', 'tuple', 'object', 'function'].includes(value.type) ?
						this._variableHandles.create(value) :
						0
			}))
		};
		this.sendResponse(response);
	}

	protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
		while (!this.machine.step());
		this.sendEvent(new TerminatedEvent());
		this.sendResponse(response);
	}

	protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
		if (!this.machine.step())
			this.sendEvent(new StoppedEvent('step', MockDebugSession.threadID));
		else
			this.sendEvent(new TerminatedEvent());
		this.sendResponse(response);
	}

	protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void {
		if (!this.machine.step())
			this.sendEvent(new StoppedEvent('step', MockDebugSession.threadID));
		else
			this.sendEvent(new TerminatedEvent());
		this.sendResponse(response);
	}

	//---- helpers

	private renderValue(value: Value | Scope<Value> | Environment<Value>): string {
		if (value instanceof Value)
			switch (value.type) {
				case 'undefined': return `#${undefined}`;
				case 'null': return `#${null}`;
				case 'boolean': return `#${(<Value.Boolean>value).value}`;
				case 'number': return JSON.stringify((<Value.Number>value).value);
				case 'string': return JSON.stringify((<Value.String>value).value);
				case 'array': return 'array';
				case 'tuple': return 'tuple';
				case 'object': return 'object';
				case 'function': return 'function';
				default: return '';
			}
		else if (value instanceof Scope<Value>)
			return 'scope';
		else
			return 'environment';
	}

	private createSource(filePath: string): Source {
		return new Source(basename(filePath), this.convertDebuggerPathToClient(filePath), undefined, undefined, 'mock-adapter-data');
	}
}

