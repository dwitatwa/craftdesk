#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { constants as fsConstants } from "node:fs";
import {
	accessSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	rmSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

const CLI_NAME = "craftdesk";
const APP_NAME = "Craftdesk";
const DEFAULT_PORT = 4000;
const MIN_NODE_VERSION = [22, 12, 0];
const PACKAGE_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const PACKAGED_SERVER_ENTRY = path.join(
	PACKAGE_ROOT,
	".output",
	"server",
	"index.mjs",
);
const runtimeRequire = createRequire(import.meta.url);

const REQUIREMENTS = [
	{
		label: "bash",
		commands: ["bash"],
		required: true,
		packages: {
			apt: ["bash"],
			dnf: ["bash"],
			pacman: ["bash"],
		},
	},
	{
		label: "git",
		commands: ["git"],
		required: true,
		packages: {
			apt: ["git"],
			dnf: ["git"],
			pacman: ["git"],
		},
	},
	{
		label: "folder picker",
		commands: ["zenity", "kdialog"],
		required: false,
		packages: {
			apt: ["zenity"],
			dnf: ["zenity"],
			pacman: ["zenity"],
		},
	},
];

async function main() {
	const { command, options } = parseCliArgs(process.argv.slice(2));

	try {
		switch (command) {
			case "install":
				await installCommand(options);
				break;
			case "start":
				await startCommand(options);
				break;
			case "stop":
				await stopCommand();
				break;
			case "delete":
				await deleteCommand(options);
				break;
			case "help":
			case undefined:
				printHelp();
				process.exit(command ? 0 : 1);
				break;
			default:
				throw new Error(
					`Unknown command "${command}". Run "${CLI_NAME} help" for usage.`,
				);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`\n${APP_NAME} CLI error: ${message}`);
		process.exit(1);
	}
}

function parseCliArgs(argv) {
	const options = {
		yes: false,
		port: DEFAULT_PORT,
	};
	let command;

	for (const argument of argv) {
		if (!command && !argument.startsWith("-")) {
			command = argument;
			continue;
		}

		if (argument === "--yes" || argument === "-y") {
			options.yes = true;
			continue;
		}

		if (argument.startsWith("--port=")) {
			options.port = parsePort(argument.slice("--port=".length));
			continue;
		}

		throw new Error(`Unsupported option "${argument}".`);
	}

	return { command, options };
}

function printHelp() {
	console.log(`${APP_NAME} Linux installer and app manager

Usage:
  ${CLI_NAME} install [--yes]
  ${CLI_NAME} start [--port=${DEFAULT_PORT}]
  ${CLI_NAME} stop
  ${CLI_NAME} delete [--yes]
  ${CLI_NAME} help

Notes:
  - Linux only.
  - The packaged app runtime stays in the global npm install location.
  - User-owned data and runtime files live under ~/.local/share/craftdesk.`);
}

async function installCommand(options) {
	ensureLinux();
	ensureNodeVersion();
	ensurePackagedRuntime();

	const paths = getInstallPaths();
	const packageManager = detectLinuxPackageManager();
	const requirements = inspectRequirements(packageManager?.name);
	const requiredMissing = requirements.filter(
		(requirement) => requirement.required && requirement.missing,
	);
	const optionalMissing = requirements.filter(
		(requirement) => !requirement.required && requirement.missing,
	);

	if (requiredMissing.length > 0 || optionalMissing.length > 0) {
		if (!packageManager) {
			const missingNames = [
				...requiredMissing.map((item) => item.label),
				...optionalMissing.map((item) => item.label),
			].join(", ");

			if (requiredMissing.length > 0) {
				throw new Error(
					`Missing Linux dependencies (${missingNames}) and no supported package manager was found. Install them manually, then run "${CLI_NAME} install" again.`,
				);
			}

			console.warn(
				`Warning: optional desktop dependency is missing (${missingNames}). The app will still work with manual path entry.`,
			);
		} else {
			await installMissingSystemPackages(
				packageManager,
				[...requiredMissing, ...optionalMissing],
				options,
			);
		}
	}

	const postInstallRequirements = inspectRequirements(packageManager?.name);
	const stillMissingRequired = postInstallRequirements.filter(
		(requirement) => requirement.required && requirement.missing,
	);

	if (stillMissingRequired.length > 0) {
		throw new Error(
			`Missing required Linux dependencies after install: ${stillMissingRequired.map((item) => item.label).join(", ")}.`,
		);
	}

	const stillMissingOptional = postInstallRequirements.filter(
		(requirement) => !requirement.required && requirement.missing,
	);

	if (stillMissingOptional.length > 0) {
		console.warn(
			`Warning: desktop folder picker is still unavailable (${stillMissingOptional.map((item) => item.label).join(", ")}). Manual path entry will still work.`,
		);
	}

	const runningMetadata = readPidMetadata(paths);

	if (runningMetadata && isProcessRunning(runningMetadata.pid)) {
		throw new Error(
			`${APP_NAME} is currently running on pid ${runningMetadata.pid}. Stop it before reinstalling.`,
		);
	}

	await mkdir(paths.installHome, { recursive: true });
	await mkdir(paths.runtimeRoot, { recursive: true });
	await mkdir(paths.runRoot, { recursive: true });
	await mkdir(paths.logsRoot, { recursive: true });
	await migrateLegacyRuntimeData(paths);
	await mkdir(paths.dataRoot, { recursive: true });

	console.log(`\n${APP_NAME} is installed.`);
	console.log(`Package runtime: ${PACKAGE_ROOT}`);
	console.log(`Data: ${paths.dataRoot}`);
	console.log(`Next step: ${CLI_NAME} start`);
}

async function startCommand(options) {
	ensureLinux();
	ensureNodeVersion();
	ensurePackagedRuntime();

	const paths = getInstallPaths();
	const metadata = readPidMetadata(paths);

	if (metadata && isProcessRunning(metadata.pid)) {
		console.log(
			`${APP_NAME} is already running on http://127.0.0.1:${metadata.port} (pid ${metadata.pid}).`,
		);
		return;
	}

	if (metadata && !isProcessRunning(metadata.pid)) {
		removePidFile(paths);
	}

	await mkdir(paths.runtimeRoot, { recursive: true });
	await mkdir(paths.runRoot, { recursive: true });
	await mkdir(paths.logsRoot, { recursive: true });
	await migrateLegacyRuntimeData(paths);
	await mkdir(paths.dataRoot, { recursive: true });

	const logFd = openSync(paths.logFile, "a");
	const child = spawn(process.execPath, [PACKAGED_SERVER_ENTRY], {
		cwd: paths.runtimeRoot,
		detached: true,
		env: {
			...process.env,
			CRAFTDESK_DATA_DIR: paths.dataRoot,
			NITRO_PORT: String(options.port),
			NODE_ENV: "production",
		},
		stdio: ["ignore", logFd, logFd],
	});

	if (!child.pid) {
		throw new Error("Failed to start the server process.");
	}

	child.unref();
	writePidMetadata(paths, {
		pid: child.pid,
		port: options.port,
		startedAt: new Date().toISOString(),
	});

	await sleep(1200);

	if (!isProcessRunning(child.pid)) {
		removePidFile(paths);
		throw new Error(
			`Server process exited immediately. Check ${paths.logFile} for details.`,
		);
	}

	console.log(`${APP_NAME} started on http://127.0.0.1:${options.port}`);
	console.log(`PID: ${child.pid}`);
	console.log(`Logs: ${paths.logFile}`);
}

async function stopCommand() {
	ensureLinux();
	const paths = getInstallPaths();
	const metadata = readPidMetadata(paths);

	if (!metadata) {
		console.log(`${APP_NAME} is not running.`);
		return;
	}

	if (!isProcessRunning(metadata.pid)) {
		removePidFile(paths);
		console.log(`${APP_NAME} is not running.`);
		return;
	}

	terminateProcessGroup(metadata.pid, "SIGTERM");
	await waitForExit(metadata.pid, 10_000);

	if (isProcessRunning(metadata.pid)) {
		terminateProcessGroup(metadata.pid, "SIGKILL");
		await waitForExit(metadata.pid, 3_000);
	}

	removePidFile(paths);

	if (isProcessRunning(metadata.pid)) {
		throw new Error(`Failed to stop pid ${metadata.pid}.`);
	}

	console.log(`${APP_NAME} stopped.`);
}

async function deleteCommand(options) {
	ensureLinux();
	const paths = getInstallPaths();
	const metadata = readPidMetadata(paths);

	if (metadata && isProcessRunning(metadata.pid)) {
		if (!(options.yes || (await confirm(`${APP_NAME} is running. Stop and delete it?`)))) {
			console.log("Delete cancelled.");
			return;
		}

		await stopCommand();
	}

	if (!existsSync(paths.installHome)) {
		console.log(`${APP_NAME} is not installed.`);
		return;
	}

	if (!(options.yes || (await confirm(`Delete ${APP_NAME} from ${paths.installHome}?`)))) {
		console.log("Delete cancelled.");
		return;
	}

	await rm(paths.installHome, { recursive: true, force: true });
	console.log(`${APP_NAME} files removed from ${paths.installHome}`);
	console.log(
		`The global "${CLI_NAME}" command is still installed. Remove it with npm uninstall -g if you no longer need it.`,
	);
}

function ensureLinux() {
	if (process.platform !== "linux") {
		throw new Error(`${APP_NAME} CLI currently supports Linux only.`);
	}
}

function ensureNodeVersion() {
	if (isNodeVersionSupported(process.versions.node)) {
		return;
	}

	throw new Error(
		`${APP_NAME} requires Node ${formatVersion(MIN_NODE_VERSION)} or newer. Current runtime: ${process.versions.node}. Reinstall the global CLI with a compatible Node version.`,
	);
}

function isNodeVersionSupported(versionString) {
	const version = versionString.replace(/^v/, "").split(".").map(Number);

	for (let index = 0; index < MIN_NODE_VERSION.length; index += 1) {
		const current = version[index] ?? 0;
		const minimum = MIN_NODE_VERSION[index];

		if (current > minimum) {
			return true;
		}

		if (current < minimum) {
			return false;
		}
	}

	return true;
}

function formatVersion(version) {
	return `v${version.join(".")}`;
}

function getInstallPaths() {
	const installHome = path.join(os.homedir(), ".local", "share", "craftdesk");

	return {
		installHome,
		dataRoot: path.join(installHome, "data"),
		runtimeRoot: path.join(installHome, "runtime"),
		runRoot: path.join(installHome, "run"),
		logsRoot: path.join(installHome, "logs"),
		pidFile: path.join(installHome, "run", "craftdesk.pid"),
		logFile: path.join(installHome, "logs", "server.log"),
	};
}

function ensurePackagedRuntime() {
	if (existsSync(PACKAGED_SERVER_ENTRY)) {
		return;
	}

	throw new Error(
		`Packaged runtime is missing. Rebuild the package with "npm run build" before installing or publishing.`,
	);
}

function ensureRuntimeDependency(moduleId) {
	try {
		runtimeRequire.resolve(moduleId);
	} catch {
		throw new Error(
			`Runtime dependency "${moduleId}" is missing from the installed CLI package. Reinstall the package with npm.`,
		);
	}
}

function detectLinuxPackageManager() {
	if (commandExists("apt-get")) {
		return {
			name: "apt",
			installCommand: ["apt-get", "install", "-y"],
			updateCommand: ["apt-get", "update"],
		};
	}

	if (commandExists("dnf")) {
		return {
			name: "dnf",
			installCommand: ["dnf", "install", "-y"],
			updateCommand: null,
		};
	}

	if (commandExists("pacman")) {
		return {
			name: "pacman",
			installCommand: ["pacman", "-S", "--needed", "--noconfirm"],
			updateCommand: null,
		};
	}

	return null;
}

function inspectRequirements(packageManagerName) {
	return REQUIREMENTS.map((requirement) => ({
		...requirement,
		missing: !requirement.commands.some((command) => commandExists(command)),
		packagesForManager:
			packageManagerName && requirement.packages[packageManagerName]
				? requirement.packages[packageManagerName]
				: [],
	}));
}

async function installMissingSystemPackages(
	packageManager,
	missingRequirements,
	options,
) {
	const packages = [
		...new Set(
			missingRequirements.flatMap((requirement) => requirement.packagesForManager),
		),
	];

	if (packages.length === 0) {
		return;
	}

	console.log("Missing Linux dependencies:");

	for (const requirement of missingRequirements) {
		const suffix = requirement.required ? "required" : "recommended";
		console.log(`- ${requirement.label} (${suffix})`);
	}

	console.log(
		`\nThe CLI will install these packages with ${packageManager.name}: ${packages.join(", ")}`,
	);

	if (!(options.yes || (await confirm("Continue with Linux package installation?")))) {
		throw new Error("Linux dependency installation was cancelled.");
	}

	const prefix = needsSudo() ? ["sudo"] : [];

	if (prefix.length > 0 && !commandExists("sudo")) {
		throw new Error(
			`Missing "sudo". Install ${packages.join(", ")} manually, then re-run "${CLI_NAME} install".`,
		);
	}

	if (packageManager.updateCommand) {
		runCommand(prefix[0] ?? packageManager.updateCommand[0], [
			...(prefix.length > 0 ? packageManager.updateCommand : packageManager.updateCommand.slice(1)),
		], {
			stdio: "inherit",
		});
	}

	runCommand(prefix[0] ?? packageManager.installCommand[0], [
		...(prefix.length > 0 ? packageManager.installCommand : packageManager.installCommand.slice(1)),
		...packages,
	], {
		stdio: "inherit",
	});
}

function needsSudo() {
	return typeof process.getuid === "function" && process.getuid() !== 0;
}

async function migrateLegacyRuntimeData(paths) {
	const legacyDataRoot = path.join(paths.runtimeRoot, "data");

	if (!existsSync(legacyDataRoot) || existsSync(paths.dataRoot)) {
		return;
	}

	await rename(legacyDataRoot, paths.dataRoot);
}

function commandExists(command) {
	const pathValue = process.env.PATH ?? "";

	for (const entry of pathValue.split(path.delimiter).filter(Boolean)) {
		const candidate = path.join(entry, command);

		try {
			const stats = statSync(candidate);

			if (!stats.isFile()) {
				continue;
			}

			accessSync(candidate, fsConstants.X_OK);
			return true;
		} catch {
			continue;
		}
	}

	return false;
}

async function confirm(message) {
	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		throw new Error(`${message} Re-run with --yes to skip prompts.`);
	}

	const readline = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	try {
		const answer = await readline.question(`${message} [y/N] `);
		return answer.trim().toLowerCase() === "y";
	} finally {
		readline.close();
	}
}

function parsePort(value) {
	const port = Number.parseInt(value, 10);

	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(`Invalid port "${value}".`);
	}

	return port;
}

function writePidMetadata(paths, metadata) {
	mkdirSync(paths.runRoot, { recursive: true });
	writeFileSync(paths.pidFile, JSON.stringify(metadata, null, 2));
}

function readPidMetadata(paths) {
	if (!existsSync(paths.pidFile)) {
		return null;
	}

	try {
		const contents = readFileSync(paths.pidFile, "utf8");
		return JSON.parse(contents);
	} catch {
		return null;
	}
}

function removePidFile(paths) {
	if (!existsSync(paths.pidFile)) {
		return;
	}

	try {
		unlinkSync(paths.pidFile);
	} catch {
		// Ignore stale pid cleanup errors.
	}
}

function isProcessRunning(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		if (error && typeof error === "object" && "code" in error) {
			return error.code !== "ESRCH";
		}

		return false;
	}
}

function terminateProcessGroup(pid, signal) {
	try {
		process.kill(-pid, signal);
	} catch (error) {
		if (
			error &&
			typeof error === "object" &&
			"code" in error &&
			error.code === "ESRCH"
		) {
			return;
		}

		try {
			process.kill(pid, signal);
		} catch (innerError) {
			if (
				!innerError ||
				typeof innerError !== "object" ||
				!("code" in innerError) ||
				innerError.code !== "ESRCH"
			) {
				throw innerError;
			}
		}
	}
}

async function waitForExit(pid, timeoutMs) {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		if (!isProcessRunning(pid)) {
			return;
		}

		await sleep(250);
	}
}

function sleep(durationMs) {
	return new Promise((resolve) => {
		setTimeout(resolve, durationMs);
	});
}

main();
