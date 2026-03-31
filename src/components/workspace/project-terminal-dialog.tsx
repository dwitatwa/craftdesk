import { Plus, Square, Terminal as TerminalIcon, X } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "#/components/ui/dialog";
import { Terminal } from "#/components/workspace/terminal";
import { disposePersistentTerminalController } from "#/components/workspace/terminal-runtime";
import type { TerminalActionRequest, TerminalStatus } from "#/lib/terminal";
import { cn } from "#/lib/utils";
import { stopScopeTerminal } from "#/server/terminal";

interface ProjectTerminalTarget {
	projectId: string;
	cwd: string;
}

interface ProjectTerminalTab {
	id: string;
	label: string;
	terminalKey: string;
	autoStart: boolean;
	status: TerminalStatus | "idle";
	isConnecting: boolean;
	actionRequest: TerminalActionRequest | null;
}

interface ProjectTerminalWorkspaceState {
	tabs: ProjectTerminalTab[];
	activeTabId: string | null;
	nextTabNumber: number;
}

interface ProjectTerminalDialogController {
	activeTab: ProjectTerminalTab | null;
	handleCloseTab: (tabId: string) => Promise<void>;
	handleCreateTab: (options?: { autoStart?: boolean }) => void;
	handleSelectTab: (tabId: string) => void;
	handleStartTab: (tabId: string) => void;
	handleStopTab: (tabId: string) => Promise<void>;
	hasTabs: boolean;
	isOpen: boolean;
	project: ProjectTerminalTarget | null;
	setIsOpen: (open: boolean) => void;
	state: ProjectTerminalWorkspaceState;
	toggle: () => void;
	updateState: (
		updater: (
			currentState: ProjectTerminalWorkspaceState,
		) => ProjectTerminalWorkspaceState,
	) => void;
}

const projectTerminalWorkspaces = new Map<
	string,
	ProjectTerminalWorkspaceState
>();

let nextTerminalActionNonce = 1;

function createTerminalActionRequest(
	type: TerminalActionRequest["type"],
): TerminalActionRequest {
	const nonce = nextTerminalActionNonce;
	nextTerminalActionNonce += 1;
	return { type, nonce };
}

function createProjectTerminalTab(
	terminalNumber: number,
	options?: { autoStart?: boolean },
): ProjectTerminalTab {
	const terminalKey = `terminal-${terminalNumber}`;

	return {
		id: terminalKey,
		label: `Terminal ${terminalNumber}`,
		terminalKey,
		autoStart: options?.autoStart ?? false,
		status: "idle",
		isConnecting: false,
		actionRequest: null,
	};
}

function createInitialProjectTerminalWorkspaceState(): ProjectTerminalWorkspaceState {
	return {
		tabs: [],
		activeTabId: null,
		nextTabNumber: 1,
	};
}

function getStoredProjectTerminalWorkspaceState(projectId: string) {
	const existingState = projectTerminalWorkspaces.get(projectId);

	if (existingState) {
		return existingState;
	}

	const initialState = createInitialProjectTerminalWorkspaceState();
	projectTerminalWorkspaces.set(projectId, initialState);
	return initialState;
}

export function isToggleProjectTerminalShortcut(event: KeyboardEvent) {
	return (
		event.ctrlKey &&
		!event.metaKey &&
		!event.altKey &&
		!event.shiftKey &&
		event.code === "Backslash"
	);
}

export function useProjectTerminalDialog(
	project: ProjectTerminalTarget | null,
): ProjectTerminalDialogController {
	const projectId = project?.projectId ?? null;
	const [isOpen, setIsOpen] = useState(false);
	const [state, setState] = useState<ProjectTerminalWorkspaceState>(() =>
		projectId
			? getStoredProjectTerminalWorkspaceState(projectId)
			: createInitialProjectTerminalWorkspaceState(),
	);

	const hasTabs = state.tabs.length > 0;
	const activeTab =
		state.tabs.find((tab) => tab.id === state.activeTabId) ??
		state.tabs[0] ??
		null;

	const updateState = (
		updater: (
			currentState: ProjectTerminalWorkspaceState,
		) => ProjectTerminalWorkspaceState,
	) => {
		if (!projectId) {
			return;
		}

		setState((currentState) => {
			const nextState = updater(currentState);
			projectTerminalWorkspaces.set(projectId, nextState);
			return nextState;
		});
	};

	useEffect(() => {
		if (!projectId) {
			setState(createInitialProjectTerminalWorkspaceState());
			setIsOpen(false);
			return;
		}

		setState(getStoredProjectTerminalWorkspaceState(projectId));
		setIsOpen(false);
	}, [projectId]);

	const handleCreateTab = (options?: { autoStart?: boolean }) => {
		if (!projectId) {
			return;
		}

		setIsOpen(true);
		updateState((currentState) => {
			const terminalNumber = currentState.nextTabNumber;
			const nextTab = createProjectTerminalTab(terminalNumber, options);

			return {
				tabs: [...currentState.tabs, nextTab],
				activeTabId: nextTab.id,
				nextTabNumber: terminalNumber + 1,
			};
		});
	};

	const toggle = () => {
		if (!projectId) {
			return;
		}

		if (hasTabs) {
			setIsOpen((currentOpen) => !currentOpen);
			return;
		}

		handleCreateTab({ autoStart: true });
	};

	const handleShortcutToggle = useEffectEvent(() => {
		toggle();
	});

	useEffect(() => {
		const handleProjectTerminalShortcut = (event: KeyboardEvent) => {
			if (
				event.defaultPrevented ||
				event.isComposing ||
				!isToggleProjectTerminalShortcut(event)
			) {
				return;
			}

			event.preventDefault();
			handleShortcutToggle();
		};

		window.addEventListener("keydown", handleProjectTerminalShortcut);

		return () => {
			window.removeEventListener("keydown", handleProjectTerminalShortcut);
		};
	}, []);

	const handleSelectTab = (tabId: string) => {
		updateState((currentState) => ({
			...currentState,
			activeTabId: tabId,
		}));
	};

	const handleStartTab = (tabId: string) => {
		setIsOpen(true);
		updateState((currentState) => ({
			...currentState,
			activeTabId: tabId,
			tabs: currentState.tabs.map((tab) =>
				tab.id === tabId
					? {
							...tab,
							autoStart: true,
							isConnecting: true,
							actionRequest: createTerminalActionRequest("start"),
						}
					: tab,
			),
		}));
	};

	const handleStopTab = async (tabId: string) => {
		if (!projectId) {
			return;
		}

		const tabToStop = state.tabs.find((tab) => tab.id === tabId);

		if (!tabToStop) {
			return;
		}

		if (state.activeTabId === tabId && isOpen) {
			updateState((currentState) => ({
				...currentState,
				tabs: currentState.tabs.map((tab) =>
					tab.id === tabId
						? {
								...tab,
								autoStart: false,
								isConnecting: true,
								actionRequest: createTerminalActionRequest("stop"),
							}
						: tab,
				),
			}));
			return;
		}

		await stopScopeTerminal({
			data: {
				scopeType: "project",
				scopeId: projectId,
				terminalKey: tabToStop.terminalKey,
			},
		});

		updateState((currentState) => ({
			...currentState,
			tabs: currentState.tabs.map((tab) =>
				tab.id === tabId
					? {
							...tab,
							autoStart: false,
							status: "stopped",
							isConnecting: false,
							actionRequest: null,
						}
					: tab,
			),
		}));
	};

	const handleCloseTab = async (tabId: string) => {
		if (!project) {
			return;
		}

		const tabToRemove = state.tabs.find((tab) => tab.id === tabId);

		if (!tabToRemove) {
			return;
		}

		let isClosingLastTab = false;

		updateState((currentState) => {
			const closingTabIndex = currentState.tabs.findIndex(
				(tab) => tab.id === tabId,
			);

			if (closingTabIndex === -1) {
				return currentState;
			}

			const nextTabs = currentState.tabs.filter((tab) => tab.id !== tabId);
			isClosingLastTab = nextTabs.length === 0;

			if (nextTabs.length === 0) {
				return {
					...currentState,
					tabs: [],
					activeTabId: null,
				};
			}

			const fallbackActiveTab =
				nextTabs[Math.min(closingTabIndex, nextTabs.length - 1)] ?? nextTabs[0];

			return {
				...currentState,
				tabs: nextTabs,
				activeTabId:
					currentState.activeTabId === tabId
						? fallbackActiveTab.id
						: currentState.activeTabId,
			};
		});

		if (isClosingLastTab) {
			setIsOpen(false);
		}

		await disposePersistentTerminalController(
			{
				scopeType: "project",
				scopeId: project.projectId,
				projectId: project.projectId,
				cwd: project.cwd,
				terminalKey: tabToRemove.terminalKey,
			},
			{ stop: true },
		);
	};

	return {
		activeTab,
		handleCloseTab,
		handleCreateTab,
		handleSelectTab,
		handleStartTab,
		handleStopTab,
		hasTabs,
		isOpen,
		project,
		setIsOpen,
		state,
		toggle,
		updateState,
	};
}

export function ProjectTerminalDialog({
	controller,
}: {
	controller: ProjectTerminalDialogController;
}) {
	const { activeTab, hasTabs, isOpen, project, setIsOpen, state, updateState } =
		controller;

	return (
		<Dialog
			open={isOpen && hasTabs && Boolean(activeTab)}
			onOpenChange={setIsOpen}
		>
			<DialogContent
				hideClose
				className="flex h-[min(78vh,760px)] max-w-[min(92vw,1180px)] flex-col gap-0 overflow-hidden border border-white/10 bg-[#09090B] p-0 shadow-[0_28px_90px_rgba(0,0,0,0.62)]"
			>
				<DialogTitle className="sr-only">Project Terminal</DialogTitle>
				<DialogDescription className="sr-only">
					View and manage terminal tabs for the current project workspace.
				</DialogDescription>
				{project && activeTab ? (
					<div className="flex min-h-0 flex-1 flex-col">
						<div className="flex items-center gap-2 border-b border-white/5 bg-[#111111] px-2 py-1.5">
							<div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
								{state.tabs.map((tab) => {
									return (
										<ProjectTerminalTabButton
											key={tab.id}
											tab={tab}
											isActive={tab.id === activeTab.id}
											onClose={controller.handleCloseTab}
											onSelect={controller.handleSelectTab}
											onStart={controller.handleStartTab}
											onStop={controller.handleStopTab}
										/>
									);
								})}
							</div>
							<div className="flex shrink-0 items-center gap-1">
								<Button
									variant="ghost"
									size="icon-xs"
									className="text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
									onClick={() =>
										controller.handleCreateTab({ autoStart: false })
									}
									aria-label="Add terminal"
								>
									<Plus className="size-3.5" />
								</Button>
								<Button
									variant="ghost"
									size="icon-xs"
									className="text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
									onClick={() => setIsOpen(false)}
									aria-label="Close terminal modal"
								>
									<X className="size-3.5" />
								</Button>
							</div>
						</div>
						<Terminal
							key={activeTab.id}
							actionRequest={activeTab.actionRequest}
							autoStart={activeTab.autoStart}
							className="min-h-0 flex-1"
							onViewStateChange={(viewState) => {
								updateState((currentState) => ({
									...currentState,
									tabs: currentState.tabs.map((tab) =>
										tab.id === activeTab.id
											? {
													...tab,
													status:
														viewState.session?.status ??
														(tab.status === "idle" ? "idle" : tab.status),
													isConnecting: viewState.isConnecting,
													actionRequest: null,
												}
											: tab,
									),
								}));
							}}
							showHeader={false}
							showStartAction={false}
							showRestartAction={false}
							showStopAction={false}
							scope={{
								scopeType: "project",
								scopeId: project.projectId,
								projectId: project.projectId,
								cwd: project.cwd,
								terminalKey: activeTab.terminalKey,
							}}
						/>
					</div>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function ProjectTerminalTabButton({
	tab,
	isActive,
	onSelect,
	onStart,
	onStop,
	onClose,
}: {
	tab: ProjectTerminalTab;
	isActive: boolean;
	onSelect: (tabId: string) => void;
	onStart: (tabId: string) => void;
	onStop: (tabId: string) => Promise<void>;
	onClose: (tabId: string) => Promise<void>;
}) {
	const isRunning = tab.status === "running";
	const canStart = !tab.isConnecting && tab.status !== "running";
	const canStop = !tab.isConnecting && isRunning;

	const handleStart = () => {
		onStart(tab.id);
	};

	const handleStop = () => {
		void onStop(tab.id);
	};

	const handleClose = () => {
		void onClose(tab.id);
	};

	return (
		<div
			className={cn(
				"flex shrink-0 items-center rounded-t-md border border-b-0 bg-[#151515] text-[11px] text-zinc-300",
				isActive
					? "border-white/30 bg-[#09090B] text-zinc-100"
					: "border-white/10 text-zinc-400 hover:bg-[#1a1a1a] hover:text-zinc-200",
			)}
		>
			<button
				type="button"
				className="max-w-36 truncate px-3 py-2 text-left"
				onClick={() => onSelect(tab.id)}
				aria-pressed={isActive}
			>
				{tab.label}
			</button>
			<div className="flex items-center gap-0.5 pr-1">
				<button
					type="button"
					className="inline-flex size-5 items-center justify-center rounded-sm text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-100 disabled:opacity-35"
					onClick={(event) => {
						event.stopPropagation();
						if (canStart) {
							handleStart();
						}
					}}
					disabled={!canStart}
					aria-label={`Start ${tab.label}`}
				>
					<TerminalIcon className="size-3" />
				</button>
				<button
					type="button"
					className="inline-flex size-5 items-center justify-center rounded-sm text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-100 disabled:opacity-35"
					onClick={(event) => {
						event.stopPropagation();
						if (canStop) {
							handleStop();
						}
					}}
					disabled={!canStop}
					aria-label={`Stop ${tab.label}`}
				>
					<Square className="size-3" />
				</button>
				<button
					type="button"
					className="inline-flex size-5 items-center justify-center rounded-sm text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-100"
					onClick={(event) => {
						event.stopPropagation();
						handleClose();
					}}
					aria-label={`Close ${tab.label}`}
				>
					<X className="size-3" />
				</button>
			</div>
		</div>
	);
}
