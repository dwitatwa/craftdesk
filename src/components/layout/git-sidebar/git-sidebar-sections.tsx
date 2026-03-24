import {
	ChevronDown,
	GitBranch,
	GitCommitHorizontal,
	LoaderCircle,
	Minus,
	Plus,
	RotateCcw,
	Send,
} from "lucide-react";
import type {
	ComponentType,
	KeyboardEvent,
	MouseEvent,
	ReactNode,
} from "react";
import { useState } from "react";

import { Button } from "#/components/ui/button";
import { Textarea } from "#/components/ui/textarea";
import type {
	GitBranchListEntry,
	GitChange,
	GitCommitPreview,
	GitDiffMode,
	GitRemote,
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
	selectedChange,
	onSelectChange,
	diffMode,
	onAction,
	onDiscardRequest,
	onGroupAction,
	pendingMutationKey,
}: {
	title: string;
	changes: GitChange[];
	selectedChange: GitSelectedChange | null;
	onSelectChange: (change: GitSelectedChange) => void;
	diffMode: GitDiffMode;
	onAction: (
		change: GitChange,
		action: "stage" | "unstage" | "discard",
	) => Promise<boolean>;
	onDiscardRequest: (change: GitChange) => void;
	onGroupAction: (action: "stage-all" | "unstage-all") => Promise<void>;
	pendingMutationKey: string;
}) {
	const isGroupMutating = pendingMutationKey === `${diffMode}:all`;

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
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						className="h-4.5 w-4.5 text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground group-hover/header:opacity-100"
						onClick={(e) => {
							e.stopPropagation();
							const action =
								diffMode === "staged" ? "unstage-all" : "stage-all";
							void onGroupAction(action);
						}}
						disabled={isGroupMutating}
						aria-label={diffMode === "staged" ? "Unstage all" : "Stage all"}
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
				) : null}
			</div>

			{changes.length > 0 ? (
				<div className="space-y-0.5">
					{changes.map((change) => {
						const isSelected =
							selectedChange?.path === change.path &&
							selectedChange.diffMode === diffMode &&
							selectedChange.code === change.code;
						const mutationKey = `${diffMode}:${change.path}:${change.code}`;
						const isMutating = pendingMutationKey === mutationKey;

						return (
							<div
								key={`${diffMode}:${change.code}:${change.path}`}
								className={cn(
									"group/item flex cursor-pointer items-center gap-2 rounded-md py-1 px-1 transition-colors",
									isSelected
										? "bg-sidebar-accent text-sidebar-accent-foreground"
										: "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground",
								)}
							>
								<button
									type="button"
									className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left outline-none"
									onClick={() => {
										onSelectChange({
											...change,
											diffMode,
										});
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
								<div className={cn(
									"flex shrink-0 items-center gap-0.5 transition-opacity duration-200",
									diffMode === "unstaged" ? "w-[44px]" : "w-[22px]",
									"opacity-0 pointer-events-none group-hover/item:opacity-100 group-hover/item:pointer-events-auto group-focus-within/item:opacity-100 group-focus-within/item:pointer-events-auto"
								)}>
									{diffMode === "unstaged" ? (
										<Button
											type="button"
											variant="ghost"
											size="icon-xs"
											className="size-5 rounded-md text-muted-foreground transition-colors hover:bg-white/10 hover:text-red-400"
											onClick={(e) => {
												e.stopPropagation();
												onDiscardRequest(change);
											}}
											disabled={isMutating}
											aria-label="Discard changes"
											title="Discard changes"
										>
											{isMutating ? (
												<LoaderCircle className="size-2.5 animate-spin" />
											) : (
												<RotateCcw className="size-2.5" />
											)}
										</Button>
									) : null}
									<Button
										type="button"
										variant="ghost"
										size="icon-xs"
										className="size-5 rounded-md text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
										onClick={(e) => {
											e.stopPropagation();
											const action =
												diffMode === "staged" ? "unstage" : "stage";
											void onAction(change, action);
										}}
										disabled={isMutating}
										aria-label={
											diffMode === "staged" ? "Unstage file" : "Stage file"
										}
										title={
											diffMode === "staged" ? "Unstage file" : "Stage file"
										}
									>
										{isMutating ? (
											<LoaderCircle className="size-2.5 animate-spin" />
										) : diffMode === "staged" ? (
											<Minus className="size-2.5" />
										) : (
											<Plus className="size-2.5" />
										)}
									</Button>
								</div>
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
			? `Pulling ${branch.name}`
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

export function RemoteRow({ remote }: { remote: GitRemote }) {
	return (
		<div className="rounded-md py-1.5 px-1 transition-colors hover:bg-white/[0.04]">
			<div className="text-[12px] font-bold text-foreground/90">
				{remote.name}
			</div>
			<div className="space-y-0.5 mt-0.5 text-[10px] font-mono text-muted-foreground/50">
				<div className="truncate">
					<span className="opacity-35">f:</span> {remote.fetchUrl ?? "—"}
				</div>
				<div className="truncate">
					<span className="opacity-35">p:</span> {remote.pushUrl ?? "—"}
				</div>
			</div>
		</div>
	);
}

export function StashRow({ stash }: { stash: GitStashEntry }) {
	return (
		<div className="cursor-pointer rounded-md py-1.5 px-1 transition-colors hover:bg-white/[0.04]">
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
