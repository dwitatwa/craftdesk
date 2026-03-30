import {
	ArrowRightLeft,
	Check,
	ChevronDown,
	Ellipsis,
	EyeOff,
	FileText,
	Flag,
	GitBranch,
	GitCommitHorizontal,
	GitFork,
	LoaderCircle,
	Minus,
	Plus,
	RotateCcw,
	ScrollText,
	Send,
	Trash2,
} from "lucide-react";
import type {
	ComponentType,
	KeyboardEvent,
	MouseEvent,
	ReactNode,
	Ref,
} from "react";
import { useEffect, useRef, useState } from "react";

import { Button } from "#/components/ui/button";
import { Textarea } from "#/components/ui/textarea";
import type {
	GitBranchListEntry,
	GitChange,
	GitCommitPreview,
	GitDiffMode,
	GitRemote,
	GitRemoteBranch,
	GitRepositoryOverview,
	GitSelectedChange,
	GitStashEntry,
} from "#/lib/git";
import { cn } from "#/lib/utils";
import {
	getBranchNameToneClassName,
	getChangeToneClassName,
} from "./git-sidebar-utils";

const GIT_SECTION_HEADER_CLASS =
	"flex items-center justify-between gap-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-foreground";
const GIT_SECTION_BODY_CLASS = "pl-3.5 pt-1.5 pb-1";

type ChangeMenuAction = {
	action:
		| "open-file"
		| "stage"
		| "unstage"
		| "ignore"
		| "discard"
		| "stash"
		| "mark";
	disabled?: boolean;
	icon: ReactNode;
	label: string;
	onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
	tone?: "default" | "danger";
};

function canIgnoreGitChange(change: GitChange) {
	return change.kind !== "deleted" && change.kind !== "unmerged";
}

function getIgnoreActionLabel(changes: GitChange[]) {
	if (changes.length === 0) {
		return null;
	}

	if (changes.every((change) => change.kind === "untracked")) {
		return "Add to .gitignore";
	}

	if (
		changes.every(
			(change) => change.kind !== "untracked" && canIgnoreGitChange(change),
		)
	) {
		return "Stop Tracking & Ignore";
	}

	return null;
}

function ChangeActionMenu({
	actions,
	ariaLabel,
	containerRef,
	isOpen,
	onOpenChange,
	triggerTitle,
}: {
	actions: ChangeMenuAction[];
	ariaLabel: string;
	containerRef?: Ref<HTMLDivElement>;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	triggerTitle: string;
}) {
	return (
		<div ref={containerRef} className="relative shrink-0">
			<button
				type="button"
				className="flex size-5 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-white/8 hover:text-foreground"
				onClick={(event) => {
					event.stopPropagation();
					onOpenChange(!isOpen);
				}}
				aria-haspopup="menu"
				aria-expanded={isOpen}
				title={triggerTitle}
			>
				<Ellipsis className="size-2.5" />
			</button>
			{isOpen ? (
				<div
					role="menu"
					aria-label={ariaLabel}
					className="absolute top-full right-0 z-20 mt-1 min-w-[148px] overflow-hidden rounded-lg border border-white/8 bg-[#0e0e10] p-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
				>
					{actions.map((item) => (
						<button
							key={item.action}
							type="button"
							role="menuitem"
							className={cn(
								"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
								item.tone === "danger"
									? "text-red-300 hover:bg-red-500/10"
									: "text-zinc-200 hover:bg-white/5",
							)}
							onClick={(event) => {
								event.stopPropagation();
								onOpenChange(false);
								item.onSelect(event);
							}}
							disabled={item.disabled}
						>
							{item.icon}
							<span>{item.label}</span>
						</button>
					))}
				</div>
			) : null}
		</div>
	);
}

export function CommitSection({
	onCommit,
	disabled = false,
	isCommitting = false,
}: {
	onCommit: (
		message: string,
		action: "commit" | "commit-push",
	) => Promise<void>;
	disabled?: boolean;
	isCommitting?: boolean;
}) {
	const [message, setMessage] = useState("");

	const handleSubmit = async (action: "commit" | "commit-push") => {
		if (!message.trim()) return;
		await onCommit(message, action);
		setMessage("");
	};

	return (
		<div className="space-y-2 py-2.5">
			<Textarea
				placeholder="Commit message (Ctrl+Enter to commit)"
				className="min-h-[64px] resize-none border-white/8 bg-black/20 text-[12px] focus-visible:ring-1 focus-visible:ring-primary/50"
				value={message}
				onChange={(e) => setMessage(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
						e.preventDefault();
						void handleSubmit("commit");
					}
				}}
				disabled={disabled || isCommitting}
			/>
			<div className="flex gap-1.5">
				<Button
					size="xs"
					variant="secondary"
					className="h-6.5 flex-1 text-[11px] font-bold"
					onClick={() => handleSubmit("commit")}
					disabled={disabled || isCommitting || !message.trim()}
				>
					{isCommitting ? (
						<LoaderCircle className="size-3 animate-spin mr-1.5" />
					) : null}
					Commit
				</Button>
				<Button
					size="xs"
					className="h-6.5 px-2"
					onClick={() => handleSubmit("commit-push")}
					disabled={disabled || isCommitting || !message.trim()}
					title="Commit & Push"
				>
					{isCommitting ? (
						<LoaderCircle className="size-3 animate-spin" />
					) : (
						<Send className="size-3" />
					)}
				</Button>
			</div>
		</div>
	);
}

export function SidebarSection({
	open,
	onOpenChange,
	title,
	icon: Icon,
	rightElement,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	icon: ComponentType<{ className?: string }>;
	rightElement?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="group py-1.5">
			<div className={GIT_SECTION_HEADER_CLASS}>
				<button
					type="button"
					className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-left outline-none"
					onClick={() => onOpenChange(!open)}
				>
					<ChevronDown
						className={cn(
							"size-2.5 transition-transform duration-200",
							open ? "rotate-0" : "-rotate-90",
						)}
					/>
					<Icon className="size-3 shrink-0 opacity-80" />
					<span className="truncate">{title}</span>
				</button>
				<div className="flex items-center gap-1">{rightElement}</div>
			</div>
			{open ? <div className={GIT_SECTION_BODY_CLASS}>{children}</div> : null}
		</div>
	);
}

export function ChangeGroup({
	title,
	changes,
	onOpenFile,
	selectedChange,
	onSelectChange,
	diffMode,
	onAction,
	onDiscardRequest,
	onGroupAction,
	pendingMutationKey,
	activeSelectionMode,
	isMarkersLoading = false,
	markedPaths,
	pendingMarkerPaths = [],
	selectedPaths = [],
	onStartSelectionMode,
	onCancelSelectionMode,
	onToggleMarker,
	onToggleSelection,
	onSelectedAction,
}: {
	title: string;
	changes: GitChange[];
	onOpenFile: (relativePath: string) => Promise<void> | void;
	selectedChange: GitSelectedChange | null;
	onSelectChange: (change: GitSelectedChange) => void;
	diffMode: GitDiffMode;
	onAction: (
		change: GitChange,
		action: "stage" | "unstage" | "ignore" | "discard" | "stash",
	) => Promise<boolean>;
	onDiscardRequest: (change: GitChange) => void;
	onGroupAction: (action: "stage-all" | "unstage-all") => Promise<void>;
	pendingMutationKey: string;
	activeSelectionMode: GitDiffMode | null;
	isMarkersLoading?: boolean;
	markedPaths: Set<string>;
	pendingMarkerPaths?: string[];
	selectedPaths?: string[];
	onStartSelectionMode: (diffMode: GitDiffMode) => void;
	onCancelSelectionMode: () => void;
	onToggleMarker: (change: GitChange) => void;
	onToggleSelection: (change: GitChange) => void;
	onSelectedAction: (
		action: "stage" | "unstage" | "ignore" | "discard" | "stash",
	) => void;
}) {
	const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
	const activeMenuRef = useRef<HTMLDivElement | null>(null);
	const selectionMenuKey = `${diffMode}:selection`;
	const isGroupMutating = pendingMutationKey === `${diffMode}:all`;
	const isSelectionModeActive = activeSelectionMode === diffMode;
	const selectedCount = selectedPaths.length;
	const isStageSelectedPending = pendingMutationKey === "stage:selected";
	const isUnstageSelectedPending = pendingMutationKey === "unstage:selected";
	const isIgnoreSelectedPending = pendingMutationKey === "ignore:selected";
	const isDiscardSelectedPending = pendingMutationKey === "discard:selected";
	const isStashSelectedPending =
		pendingMutationKey === `stash:${diffMode}:selected`;
	const isSelectionMenuOpen = openMenuKey === selectionMenuKey;
	const selectedChanges = isSelectionModeActive
		? changes.filter((change) => selectedPaths.includes(change.path))
		: [];
	const ignoreSelectedActionLabel = getIgnoreActionLabel(selectedChanges);

	useEffect(() => {
		if (!isSelectionModeActive && isSelectionMenuOpen) {
			setOpenMenuKey(null);
		}
	}, [isSelectionMenuOpen, isSelectionModeActive]);

	useEffect(() => {
		if (!openMenuKey) {
			return;
		}

		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target as Node;

			if (activeMenuRef.current?.contains(target)) {
				return;
			}

			setOpenMenuKey(null);
		};

		const handleEscape = (event: globalThis.KeyboardEvent) => {
			if (event.key !== "Escape") {
				return;
			}

			setOpenMenuKey(null);
		};

		window.addEventListener("pointerdown", handlePointerDown);
		window.addEventListener("keydown", handleEscape);

		return () => {
			window.removeEventListener("pointerdown", handlePointerDown);
			window.removeEventListener("keydown", handleEscape);
		};
	}, [openMenuKey]);

	const selectionMenuActions: ChangeMenuAction[] = [
		{
			action: diffMode === "staged" ? "unstage" : "stage",
			disabled:
				selectedCount === 0 ||
				(diffMode === "staged"
					? isUnstageSelectedPending
					: isStageSelectedPending),
			icon:
				diffMode === "staged" ? (
					isUnstageSelectedPending ? (
						<LoaderCircle className="size-3 animate-spin text-zinc-400" />
					) : (
						<Minus className="size-3 text-zinc-400" />
					)
				) : isStageSelectedPending ? (
					<LoaderCircle className="size-3 animate-spin text-zinc-400" />
				) : (
					<Plus className="size-3 text-zinc-400" />
				),
			label: diffMode === "staged" ? "Unstage" : "Stage",
			onSelect: () => {
				onSelectedAction(diffMode === "staged" ? "unstage" : "stage");
			},
		},
		{
			action: "stash",
			disabled: selectedCount === 0 || isStashSelectedPending,
			icon: isStashSelectedPending ? (
				<LoaderCircle className="size-3 animate-spin text-zinc-400" />
			) : (
				<ScrollText className="size-3 text-zinc-400" />
			),
			label: "Stash",
			onSelect: () => {
				onSelectedAction("stash");
			},
		},
	];

	if (ignoreSelectedActionLabel) {
		selectionMenuActions.push({
			action: "ignore",
			disabled: isIgnoreSelectedPending,
			icon: isIgnoreSelectedPending ? (
				<LoaderCircle className="size-3 animate-spin text-zinc-400" />
			) : (
				<EyeOff className="size-3 text-zinc-400" />
			),
			label: ignoreSelectedActionLabel,
			onSelect: () => {
				onSelectedAction("ignore");
			},
		});
	}

	if (diffMode === "unstaged") {
		selectionMenuActions.push({
			action: "discard",
			disabled: selectedCount === 0 || isDiscardSelectedPending,
			icon: isDiscardSelectedPending ? (
				<LoaderCircle className="size-3 animate-spin text-red-300/70" />
			) : (
				<RotateCcw className="size-3 text-red-300/70" />
			),
			label: "Discard",
			onSelect: () => {
				onSelectedAction("discard");
			},
			tone: "danger",
		});
	}

	return (
		<div className="space-y-1">
			<div className="group/header flex items-center justify-between py-0.5">
				<div className="flex items-center gap-1.5">
					<div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
						{title}
					</div>
					<div className="text-[10px] font-mono text-muted-foreground/30">
						{changes.length}
					</div>
				</div>
				{changes.length > 0 ? (
					<div className="flex items-center gap-1">
						{isSelectionModeActive ? (
							<>
								<ChangeActionMenu
									actions={selectionMenuActions}
									ariaLabel={`Selected ${title.toLowerCase()} actions`}
									containerRef={isSelectionMenuOpen ? activeMenuRef : undefined}
									isOpen={isSelectionMenuOpen}
									onOpenChange={(open) => {
										setOpenMenuKey(open ? selectionMenuKey : null);
									}}
									triggerTitle={`Selected ${title.toLowerCase()} actions`}
								/>
								<Button
									type="button"
									variant="ghost"
									size="xs"
									className="h-5 px-1.5 text-[10px] font-bold text-muted-foreground/50 hover:text-foreground"
									onClick={(event) => {
										event.stopPropagation();
										onCancelSelectionMode();
									}}
								>
									Cancel
								</Button>
							</>
						) : (
							<>
								<Button
									type="button"
									variant="ghost"
									size="xs"
									className="h-5 px-1.5 text-[10px] font-bold text-muted-foreground/50 hover:text-foreground"
									onClick={(event) => {
										event.stopPropagation();
										onStartSelectionMode(diffMode);
									}}
									title={`Select ${title.toLowerCase()} changes`}
								>
									Select
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-xs"
									className="h-4.5 w-4.5 text-muted-foreground/40 hover:text-foreground"
									onClick={(event) => {
										event.stopPropagation();
										const action =
											diffMode === "staged" ? "unstage-all" : "stage-all";
										void onGroupAction(action);
									}}
									disabled={isGroupMutating}
									aria-label={
										diffMode === "staged" ? "Unstage all" : "Stage all"
									}
									title={diffMode === "staged" ? "Unstage all" : "Stage all"}
								>
									{isGroupMutating ? (
										<LoaderCircle className="size-2.5 animate-spin" />
									) : diffMode === "staged" ? (
										<Minus className="size-2.5" />
									) : (
										<Plus className="size-2.5" />
									)}
								</Button>
							</>
						)}
					</div>
				) : null}
			</div>

			{changes.length > 0 ? (
				<div className="space-y-0.5">
					{changes.map((change) => {
						const isSelected =
							selectedChange?.path === change.path &&
							selectedChange.diffMode === diffMode &&
							selectedChange.code === change.code;
						const isBatchSelected = isSelectionModeActive
							? selectedPaths.includes(change.path)
							: false;
						const actionMutationKey =
							diffMode === "staged"
								? `unstage:${change.path}:${change.code}`
								: `stage:${change.path}:${change.code}`;
						const discardMutationKey = `discard:${change.path}:${change.code}`;
						const ignoreMutationKey = `ignore:${change.path}:${change.code}`;
						const stashMutationKey = `stash:${diffMode}:${change.path}:${change.code}`;
						const isMutating =
							pendingMutationKey === actionMutationKey ||
							pendingMutationKey === ignoreMutationKey ||
							pendingMutationKey === discardMutationKey ||
							pendingMutationKey === stashMutationKey;
						const rowMenuKey = `${diffMode}:${change.code}:${change.path}`;
						const isRowMenuOpen = openMenuKey === rowMenuKey;
						const ignoreActionLabel = getIgnoreActionLabel([change]);
						const isMarked = markedPaths.has(change.path);
						const isMarkerPending =
							isMarkersLoading || pendingMarkerPaths.includes(change.path);
						const markerMenuAction: ChangeMenuAction = {
							action: "mark",
							disabled: isMarkerPending,
							icon: isMarkerPending ? (
								<LoaderCircle className="size-3 animate-spin text-zinc-400" />
							) : (
								<Flag
									className={cn(
										"size-3 text-zinc-400",
										isMarked ? "fill-current text-amber-300" : undefined,
									)}
								/>
							),
							label: isMarked ? "Unmark" : "Mark",
							onSelect: () => {
								onToggleMarker(change);
							},
						};
						const rowMenuActions: ChangeMenuAction[] =
							diffMode === "unstaged"
								? [
										{
											action: "stage",
											disabled: isMutating,
											icon:
												pendingMutationKey === actionMutationKey ? (
													<LoaderCircle className="size-3 animate-spin text-zinc-400" />
												) : (
													<Plus className="size-3 text-zinc-400" />
												),
											label: "Stage",
											onSelect: () => {
												void onAction(change, "stage");
											},
										},
										{
											action: "open-file",
											disabled: isMutating,
											icon: <FileText className="size-3 text-zinc-400" />,
											label: "Open file",
											onSelect: () => {
												void onOpenFile(change.path);
											},
										},
										markerMenuAction,
										{
											action: "stash",
											disabled: isMutating,
											icon:
												pendingMutationKey === stashMutationKey ? (
													<LoaderCircle className="size-3 animate-spin text-zinc-400" />
												) : (
													<ScrollText className="size-3 text-zinc-400" />
												),
											label: "Stash",
											onSelect: () => {
												void onAction(change, "stash");
											},
										},
									]
								: [
										{
											action: "open-file",
											disabled: isMutating,
											icon: <FileText className="size-3 text-zinc-400" />,
											label: "Open file",
											onSelect: () => {
												void onOpenFile(change.path);
											},
										},
										markerMenuAction,
										{
											action: "unstage",
											disabled: isMutating,
											icon:
												pendingMutationKey === actionMutationKey ? (
													<LoaderCircle className="size-3 animate-spin text-zinc-400" />
												) : (
													<Minus className="size-3 text-zinc-400" />
												),
											label: "Unstage",
											onSelect: () => {
												void onAction(change, "unstage");
											},
										},
										{
											action: "stash",
											disabled: isMutating,
											icon:
												pendingMutationKey === stashMutationKey ? (
													<LoaderCircle className="size-3 animate-spin text-zinc-400" />
												) : (
													<ScrollText className="size-3 text-zinc-400" />
												),
											label: "Stash",
											onSelect: () => {
												void onAction(change, "stash");
											},
										},
									];

						if (ignoreActionLabel) {
							rowMenuActions.push({
								action: "ignore",
								disabled: isMutating,
								icon:
									pendingMutationKey === ignoreMutationKey ? (
										<LoaderCircle className="size-3 animate-spin text-zinc-400" />
									) : (
										<EyeOff className="size-3 text-zinc-400" />
									),
								label: ignoreActionLabel,
								onSelect: () => {
									void onAction(change, "ignore");
								},
							});
						}

						if (diffMode === "unstaged") {
							rowMenuActions.push({
								action: "discard",
								disabled: isMutating,
								icon:
									pendingMutationKey === discardMutationKey ? (
										<LoaderCircle className="size-3 animate-spin text-red-300/70" />
									) : (
										<RotateCcw className="size-3 text-red-300/70" />
									),
								label: "Discard",
								onSelect: () => {
									onDiscardRequest(change);
								},
								tone: "danger",
							});
						}

						return (
							<div
								key={`${diffMode}:${change.code}:${change.path}`}
								className={cn(
									"group/item flex cursor-pointer items-center gap-2 rounded-md py-1 px-1 transition-colors",
									isSelected
										? "bg-sidebar-accent text-sidebar-accent-foreground"
										: isBatchSelected
											? "bg-white/[0.04] text-foreground"
											: "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground",
								)}
							>
								{isSelectionModeActive ? (
									<button
										type="button"
										className={cn(
											"flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
											isBatchSelected
												? "border-emerald-400/70 bg-emerald-500/15 text-emerald-200"
												: "border-white/10 bg-black/10 text-transparent hover:border-white/20",
										)}
										onClick={(event) => {
											event.stopPropagation();
											onToggleSelection(change);
										}}
										aria-label={
											isBatchSelected
												? `Unselect ${change.path}`
												: `Select ${change.path}`
										}
										aria-pressed={isBatchSelected}
										title={
											isBatchSelected
												? `Unselect ${change.path}`
												: `Select ${change.path}`
										}
									>
										<Check className="size-2.5" />
									</button>
								) : null}
								<button
									type="button"
									className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left outline-none"
									onClick={() => {
										if (isSelectionModeActive) {
											onToggleSelection(change);
											return;
										}

										onSelectChange({
											...change,
											diffMode,
										});
									}}
									onContextMenu={(event) => {
										if (isSelectionModeActive) {
											return;
										}

										event.preventDefault();
										event.stopPropagation();
										setOpenMenuKey(rowMenuKey);
									}}
									title={change.path}
								>
									<span
										className={cn(
											"inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm text-[9px] font-bold",
											getChangeToneClassName(change.code),
										)}
									>
										{change.code}
									</span>
									<div className="flex-1 min-w-0 flex items-baseline gap-1.5">
										<span
											className={cn(
												"truncate text-[12px] font-medium leading-tight shrink-0 max-w-[140px]",
												isSelected
													? "text-sidebar-accent-foreground"
													: isMarked
														? "text-amber-300"
														: "text-foreground",
											)}
										>
											{change.path.split("/").pop()}
										</span>
										<span
											className={cn(
												"truncate text-[10px] font-mono min-w-0 flex-1",
												isSelected
													? "text-sidebar-accent-foreground/40"
													: "text-muted-foreground/35",
											)}
										>
											{change.path.split("/").slice(0, -1).join("/")}
										</span>
									</div>
								</button>
								{!isSelectionModeActive ? (
									<ChangeActionMenu
										actions={rowMenuActions}
										ariaLabel={`${change.path} actions`}
										containerRef={isRowMenuOpen ? activeMenuRef : undefined}
										isOpen={isRowMenuOpen}
										onOpenChange={(open) => {
											setOpenMenuKey(open ? rowMenuKey : null);
										}}
										triggerTitle={`${change.path} actions`}
									/>
								) : null}
							</div>
						);
					})}
				</div>
			) : (
				<EmptyState label={`No ${title.toLowerCase()} changes.`} />
			)}
		</div>
	);
}

export function BranchSummaryCard({
	branch,
	isPushing = false,
	onPush,
	pushState = "ready",
}: {
	branch: GitRepositoryOverview["branch"];
	isPushing?: boolean;
	onPush?: () => void;
	pushState?: "ready" | "synced" | "behind";
}) {
	const pushLabel =
		pushState === "synced"
			? "Synced"
			: pushState === "behind"
				? "Behind"
				: "Push";
	const pushTitle = branch.detached
		? "Push is unavailable while HEAD is detached"
		: pushState === "synced"
			? "This branch is already in sync with its upstream"
			: pushState === "behind"
				? "This branch is behind its upstream and has nothing to push"
				: branch.upstream
					? "Push current branch"
					: "Publish current branch to origin";

	return (
		<div className="py-1.5">
			<div className="flex items-center justify-between gap-2.5">
				<div className="min-w-0">
					<div className="truncate text-[12px] font-bold">{branch.name}</div>
					<div className="truncate text-[10px] font-mono text-muted-foreground/50">
						{branch.upstream ??
							(branch.detached ? "Detached HEAD" : "No upstream")}
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-1.5">
					<Button
						type="button"
						variant="secondary"
						size="xs"
						className="h-5.5 px-1.5 text-[10px] font-bold"
						onClick={onPush}
						disabled={!onPush || branch.detached || isPushing}
						title={pushTitle}
					>
						{isPushing ? (
							<LoaderCircle className="size-2.5 animate-spin" />
						) : (
							<Send className="size-2.5" />
						)}
						{pushLabel}
					</Button>
					<div className="flex gap-1 text-[9px] font-mono opacity-50">
						<InlineMetric label="A" value={branch.ahead} />
						<InlineMetric label="B" value={branch.behind} />
					</div>
				</div>
			</div>
		</div>
	);
}

export function CommitRow({ commit }: { commit: GitCommitPreview }) {
	return (
		<div className="group/commit cursor-pointer rounded-md py-1.5 px-1 transition-colors hover:bg-white/[0.04]">
			<div className="flex items-center gap-1.5">
				<GitCommitHorizontal className="size-2.5 shrink-0 text-muted-foreground/35" />
				<div className="min-w-0 flex-1 flex items-center justify-between gap-1.5">
					<div className="truncate text-[12px] font-medium text-foreground/90">
						{commit.summary}
					</div>
					<div className="shrink-0 text-[10px] font-mono text-muted-foreground/35">
						{commit.shortSha}
					</div>
				</div>
			</div>
			<div className="mt-0.5 flex items-center justify-between gap-2 pl-4">
				<div className="truncate text-[10px] text-muted-foreground/45">
					{commit.author}
				</div>
				<div className="shrink-0 text-[10px] text-muted-foreground/35 italic">
					{commit.relativeDate}
				</div>
			</div>
		</div>
	);
}

export function BranchRow({
	branch,
	currentBranch,
	isCheckingOut = false,
	isPulling = false,
	isPushing = false,
	onOpenContextMenu,
	onShowCommits,
}: {
	branch: GitBranchListEntry;
	currentBranch?: GitRepositoryOverview["branch"] | null;
	isCheckingOut?: boolean;
	isPulling?: boolean;
	isPushing?: boolean;
	onOpenContextMenu?: (position: { x: number; y: number }) => void;
	onShowCommits?: () => void;
}) {
	const details = branch.isCurrent
		? currentBranch?.upstream
			? `⇄ ${currentBranch.upstream}`
			: currentBranch?.detached
				? "Detached HEAD"
				: "No upstream"
		: null;
	const hasBranchUpstream = branch.isCurrent
		? Boolean(currentBranch?.upstream)
		: Boolean(branch.upstream);
	const branchNameClassName = getBranchNameToneClassName(branch);
	const isBusy = isCheckingOut || isPulling || isPushing;
	const busyLabel = isCheckingOut
		? `Checking out ${branch.name}`
		: isPulling
			? `${branch.isCurrent ? "Pulling" : "Updating"} ${branch.name}`
			: hasBranchUpstream
				? `Pushing ${branch.name}`
				: `Publishing ${branch.name}`;
	const branchContent = (
		<>
			<GitBranch className="size-2.5 shrink-0 text-muted-foreground/60" />
			<div className="min-w-0 flex items-center gap-1.5 text-[12px]">
				<div className={cn("truncate font-medium", branchNameClassName)}>
					{branch.name}
				</div>
				{details ? (
					<div className="truncate text-[10px] text-muted-foreground/50">
						{details}
					</div>
				) : null}
			</div>
			<div className="shrink-0 text-[10px] text-muted-foreground/40">
				• {branch.lastCommitRelativeDate}
			</div>
		</>
	);
	const handleKeyboardContextMenu = (
		event: KeyboardEvent<HTMLButtonElement>,
	) => {
		if (
			event.key !== "ContextMenu" &&
			!(event.shiftKey && event.key === "F10")
		) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		if (!onOpenContextMenu) {
			return;
		}

		const bounds = event.currentTarget.getBoundingClientRect();
		onOpenContextMenu({
			x: bounds.right - 12,
			y: bounds.top + bounds.height / 2,
		});
	};
	const handleMouseContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
		if (!onOpenContextMenu) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		onOpenContextMenu({
			x: event.clientX,
			y: event.clientY,
		});
	};

	return (
		<div
			className={cn(
				"group/branch flex items-center justify-between gap-2.5 rounded-md py-1.5 px-1 transition-colors",
				branch.isCurrent
					? "bg-primary/10 text-foreground"
					: "hover:bg-white/[0.04]",
			)}
		>
			{onShowCommits ? (
				<button
					type="button"
					className="min-w-0 flex flex-1 cursor-pointer items-center gap-1.5 rounded-sm bg-transparent p-0 text-left outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
					onClick={onShowCommits}
					onContextMenu={handleMouseContextMenu}
					onKeyDown={handleKeyboardContextMenu}
					title={`Show recent commits for ${branch.name}`}
					aria-haspopup="menu"
				>
					{branchContent}
				</button>
			) : (
				<div className="min-w-0 flex flex-1 items-center gap-1.5">
					{branchContent}
				</div>
			)}
			{isBusy ? (
				<div
					className="flex shrink-0 items-center gap-1 text-muted-foreground"
					title={busyLabel}
				>
					<LoaderCircle className="size-2.5 animate-spin" />
				</div>
			) : null}
		</div>
	);
}

export function RemoteRow({
	remote,
	isOpen,
	onOpenChange,
	activeRefName,
	onCheckoutBranch,
	pendingCheckoutRefName,
}: {
	remote: GitRemote;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	activeRefName?: string | null;
	onCheckoutBranch: (refName: string) => void;
	pendingCheckoutRefName?: string | null;
}) {
	const remoteTitle = [remote.fetchUrl, remote.pushUrl]
		.filter(Boolean)
		.join("\n");

	return (
		<div className="py-0.5">
			<button
				type="button"
				className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left text-[12px] text-muted-foreground transition-colors hover:bg-sidebar-accent/40 hover:text-foreground"
				onClick={() => onOpenChange(!isOpen)}
				title={remoteTitle || remote.name}
				aria-expanded={isOpen}
			>
				<ChevronDown
					className={cn(
						"size-3 shrink-0 transition-transform duration-150",
						isOpen ? "rotate-0" : "-rotate-90",
					)}
				/>
				<GitFork className="size-3 shrink-0 text-muted-foreground/70" />
				<span className="min-w-0 truncate font-medium text-foreground/90">
					{remote.name}
				</span>
			</button>

			{isOpen ? (
				<div className="mt-0.5 space-y-0.5 pl-4">
					{remote.branches.length > 0 ? (
						remote.branches.map((branch) => (
							<RemoteBranchRow
								key={branch.refName}
								branch={branch}
								isActive={branch.refName === activeRefName}
								isCheckingOut={branch.refName === pendingCheckoutRefName}
								onCheckout={() => onCheckoutBranch(branch.refName)}
							/>
						))
					) : (
						<EmptyState label="No remote-tracking branches were found." />
					)}
				</div>
			) : null}
		</div>
	);
}

function RemoteBranchRow({
	branch,
	isActive = false,
	isCheckingOut = false,
	onCheckout,
}: {
	branch: GitRemoteBranch;
	isActive?: boolean;
	isCheckingOut?: boolean;
	onCheckout: () => void;
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-2 rounded-md px-1 py-1 text-[12px] transition-colors",
				isActive
					? "bg-sidebar-accent/60 text-sidebar-accent-foreground"
					: "text-muted-foreground hover:bg-sidebar-accent/30 hover:text-foreground",
			)}
			title={branch.refName}
		>
			<GitBranch className="size-3 shrink-0 text-muted-foreground/65" />
			<span className="min-w-0 flex-1 truncate font-medium">{branch.name}</span>
			<span
				className={cn(
					"shrink-0 text-[10px]",
					isActive
						? "text-sidebar-accent-foreground/65"
						: "text-muted-foreground/45",
				)}
			>
				{branch.lastCommitRelativeDate}
			</span>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				className="size-5 shrink-0 rounded-md text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
				onClick={(event) => {
					event.stopPropagation();
					onCheckout();
				}}
				disabled={isCheckingOut}
				aria-label={`Checkout ${branch.name} to local branch`}
				title={`Checkout ${branch.name} to local branch`}
			>
				{isCheckingOut ? (
					<LoaderCircle className="size-2.5 animate-spin" />
				) : (
					<ArrowRightLeft className="size-2.5" />
				)}
			</Button>
		</div>
	);
}

export function StashRow({
	stash,
	onApply,
	onDelete,
	isApplying = false,
	isDeleting = false,
}: {
	stash: GitStashEntry;
	onApply: () => void;
	onDelete: () => void;
	isApplying?: boolean;
	isDeleting?: boolean;
}) {
	return (
		<div className="rounded-md py-1.5 px-1 transition-colors hover:bg-white/[0.04]">
			<div className="flex items-center justify-between gap-2.5">
				<div className="min-w-0">
					<div className="truncate text-[12px] font-bold text-foreground/90">
						{stash.name}
					</div>
					<div className="truncate text-[10px] text-muted-foreground/50">
						{stash.message}
					</div>
				</div>
				<div className="shrink-0 text-[10px] text-muted-foreground/35">
					{stash.relativeDate}
				</div>
			</div>
			<div className="mt-1.5 flex items-center justify-end gap-1">
				<Button
					type="button"
					variant="ghost"
					size="xs"
					className="h-5 px-1.5 text-[10px] font-bold text-muted-foreground/55 hover:text-foreground"
					onClick={onApply}
					disabled={isApplying || isDeleting}
					title={`Apply ${stash.name}`}
				>
					{isApplying ? (
						<LoaderCircle className="size-2.5 animate-spin" />
					) : (
						<ArrowRightLeft className="size-2.5" />
					)}
					<span>Apply</span>
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="xs"
					className="h-5 px-1.5 text-[10px] font-bold text-muted-foreground/55 hover:text-red-300"
					onClick={onDelete}
					disabled={isApplying || isDeleting}
					title={`Delete ${stash.name}`}
				>
					{isDeleting ? (
						<LoaderCircle className="size-2.5 animate-spin" />
					) : (
						<Trash2 className="size-2.5" />
					)}
					<span>Delete</span>
				</Button>
			</div>
		</div>
	);
}

function InlineMetric({ label, value }: { label: string; value: number }) {
	return (
		<div className="text-[10px] font-mono text-muted-foreground">
			{label}:{value}
		</div>
	);
}

export function EmptyState({ label }: { label: string }) {
	return (
		<div className="py-1 text-[11px] italic text-muted-foreground/40">
			{label}
		</div>
	);
}
