import { execFile } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PICKER_TITLE = "Select a project folder for Craftdesk";

interface PickerCommand {
	command: string;
	args: string[];
}

export class FolderPickerUnavailableError extends Error {}

export async function pickDirectoryPath() {
	const commands = getPickerCommands();

	for (const picker of commands) {
		const result = await tryRunPicker(picker);

		if (result.type === "missing") {
			continue;
		}

		if (result.type === "cancelled") {
			return null;
		}

		return normalizeDirectoryPath(result.path);
	}

	throw new FolderPickerUnavailableError(getUnavailableMessage());
}

function getPickerCommands(): PickerCommand[] {
	switch (process.platform) {
		case "darwin":
			return [
				{
					command: "osascript",
					args: [
						"-e",
						`POSIX path of (choose folder with prompt "${PICKER_TITLE}")`,
					],
				},
			];
		case "win32":
			return [
				{
					command: "powershell.exe",
					args: [
						"-NoProfile",
						"-STA",
						"-Command",
						[
							"Add-Type -AssemblyName System.Windows.Forms",
							"$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
							`$dialog.Description = '${PICKER_TITLE}'`,
							"$dialog.UseDescriptionForTitle = $true",
							"if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
							"  [Console]::Out.Write($dialog.SelectedPath)",
							"}",
						].join("; "),
					],
				},
			];
		default:
			return [
				{
					command: "zenity",
					args: ["--file-selection", "--directory", "--title", PICKER_TITLE],
				},
				{
					command: "kdialog",
					args: [
						"--getexistingdirectory",
						os.homedir(),
						"--title",
						PICKER_TITLE,
					],
				},
			];
	}
}

async function tryRunPicker(picker: PickerCommand) {
	try {
		const { stdout } = await execFileAsync(picker.command, picker.args, {
			windowsHide: true,
		});
		const selectedPath = extractSelectedPath(stdout);

		if (!selectedPath) {
			return { type: "cancelled" } as const;
		}

		return {
			type: "selected",
			path: selectedPath,
		} as const;
	} catch (error) {
		if (!isExecError(error)) {
			throw error;
		}

		if (error.code === "ENOENT") {
			return { type: "missing" } as const;
		}

		if (isPickerCancellation(error)) {
			return { type: "cancelled" } as const;
		}

		const details = error.stderr?.trim() || error.message;
		throw new Error(`Failed to open the native folder picker. ${details}`);
	}
}

function isExecError(error: unknown): error is Error & {
	code?: number | string;
	stdout?: string;
	stderr?: string;
} {
	return error instanceof Error;
}

function isPickerCancellation(error: {
	code?: number | string;
	stdout?: string;
	stderr?: string;
}) {
	const stdout = error.stdout?.trim() ?? "";
	const stderr = error.stderr?.trim() ?? "";
	const combined = `${stdout}\n${stderr}`.toLowerCase();

	if (combined.includes("user canceled")) {
		return true;
	}

	return error.code === 1 && !stdout;
}

function extractSelectedPath(stdout: string) {
	return stdout
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find(Boolean);
}

function normalizeDirectoryPath(rawPath: string) {
	const normalized = path.normalize(rawPath.trim());
	const parsed = path.parse(normalized);
	const trimmed =
		normalized === parsed.root
			? normalized
			: normalized.replace(/[\\/]+$/g, "");

	if (!trimmed) {
		throw new Error("The selected folder path was empty.");
	}

	if (!existsSync(trimmed) || !statSync(trimmed).isDirectory()) {
		throw new Error(`The selected folder does not exist: ${trimmed}`);
	}

	return trimmed;
}

function getUnavailableMessage() {
	switch (process.platform) {
		case "darwin":
			return "The native folder picker is unavailable because osascript could not be started. Enter the path manually instead.";
		case "win32":
			return "The native folder picker is unavailable because PowerShell could not be started. Enter the path manually instead.";
		default:
			return "The native folder picker is unavailable. Install zenity or kdialog, or enter the path manually instead.";
	}
}
