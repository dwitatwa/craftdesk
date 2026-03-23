import {
	ChevronDown,
	GitCommitHorizontal,
	LoaderCircle,
	Minus,
	Plus,
	RotateCcw,
	Send,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
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
import { getChangeToneClassName } from "./git-sidebar-utils";

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
		<div className="px-3 py-2 space-y-2">
			<Textarea
				placeholder="Commit message (Ctrl+Enter to commit)"
				className="min-h-[60px] text-[11px] resize-none bg-black/20 border-white/5 focus-visible:ring-1 focus-visible:ring-primary/50"
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
					size="sm"
					variant="secondary"
					className="flex-1 h-7 text-[10px] font-bold"
					onClick={() => handleSubmit("commit")}
					disabled={disabled || isCommitting || !message.trim()}
				>
					{isCommitting ? (
						<LoaderCircle className="size-3 animate-spin mr-1.5" />
					) : null}
					Commit
				</Button>
				<Button
					size="sm"
					className="h-7 px-2"
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
		<div className="group">
			<div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 transition-colors hover:text-foreground">
				<button
					type="button"
					className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-left outline-none"
					onClick={() => onOpenChange(!open)}
				>
					<ChevronDown
						className={cn(
							"size-3 transition-transform duration-200",
							open ? "rotate-0" : "-rotate-90",
						)}
					/>
					<Icon className="size-3 shrink-0" />
					<span className="truncate">{title}</span>
				</button>
				<div className="flex items-center gap-1">{rightElement}</div>
			</div>
			{open ? <div className="pb-1">{children}</div> : null}
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
		<div className="space-y-0.5">
			<div className="group/header flex items-center justify-between px-3 py-0.5 bg-white/[0.03] transition-colors hover:bg-white/[0.06]">
				<div className="flex items-center gap-2">
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
						className="opacity-0 group-hover/header:opacity-100 h-4 w-4 text-muted-foreground/50 hover:text-foreground transition-opacity"
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
				<div className="space-y-[1px]">
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
									"group/item flex items-center gap-2 px-3 py-0.5 transition-colors cursor-pointer",
									isSelected
										? "bg-sidebar-accent text-sidebar-accent-foreground"
										: "hover:bg-sidebar-accent/40 text-muted-foreground hover:text-foreground",
								)}
							>
								<button
									type="button"
									className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none"
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
											"inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-[9px] font-bold",
											getChangeToneClassName(change.code),
										)}
									>
										{change.code}
									</span>
									<div className="flex-1 min-w-0">
										<div className="flex items-baseline gap-1.5 min-w-0">
											<span
												className={cn(
													"truncate text-[11px] font-medium leading-tight",
													isSelected
														? "text-sidebar-accent-foreground"
														: "text-foreground",
												)}
											>
												{change.path.split("/").pop()}
											</span>
											<span
												className={cn(
													"truncate text-[9px] font-mono",
													isSelected
														? "text-sidebar-accent-foreground/50"
														: "text-muted-foreground/40",
												)}
											>
												{change.path.split("/").slice(0, -1).join("/")}
											</span>
										</div>
									</div>
								</button>
								<div className="flex shrink-0 items-center gap-1 opacity-0 pointer-events-none transition-opacity group-hover/item:opacity-100 group-hover/item:pointer-events-auto group-focus-within/item:opacity-100 group-focus-within/item:pointer-events-auto">
									{diffMode === "unstaged" ? (
										<Button
											type="button"
											variant="ghost"
											size="icon-xs"
											className="h-4 w-4 text-muted-foreground hover:text-red-500"
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
										className="h-4 w-4 text-muted-foreground hover:text-foreground"
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
}: {
	branch: GitRepositoryOverview["branch"];
}) {
	return (
		<div className="px-3 py-1">
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0">
					<div className="truncate text-[11px] font-bold">{branch.name}</div>
					<div className="truncate text-[10px] font-mono text-muted-foreground/60">
						{branch.upstream ??
							(branch.detached ? "Detached HEAD" : "No upstream")}
					</div>
				</div>
				<div className="flex shrink-0 gap-1.5 text-[9px] font-mono opacity-60">
					<InlineMetric label="A" value={branch.ahead} />
					<InlineMetric label="B" value={branch.behind} />
				</div>
			</div>
		</div>
	);
}

export function CommitRow({ commit }: { commit: GitCommitPreview }) {
	return (
		<div className="px-3 py-1 hover:bg-white/[0.05] transition-colors group/commit cursor-pointer">
			<div className="flex items-center gap-2">
				<GitCommitHorizontal className="size-3 shrink-0 text-muted-foreground/40" />
				<div className="min-w-0 flex-1 flex items-center justify-between gap-2">
					<div className="truncate text-[11px] font-medium">
						{commit.summary}
					</div>
					<div className="shrink-0 text-[9px] font-mono text-muted-foreground/40">
						{commit.shortSha}
					</div>
				</div>
			</div>
			<div className="pl-5 flex items-center justify-between gap-2 mt-0.5">
				<div className="truncate text-[9px] text-muted-foreground/50">
					{commit.author}
				</div>
				<div className="shrink-0 text-[9px] text-muted-foreground/40 italic">
					{commit.relativeDate}
				</div>
			</div>
		</div>
	);
}

export function BranchRow({ branch }: { branch: GitBranchListEntry }) {
	return (
		<div
			className={cn(
				"px-3 py-1 transition-colors cursor-pointer",
				branch.isCurrent
					? "bg-primary/20 text-primary-foreground"
					: "hover:bg-white/[0.05]",
			)}
		>
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0 flex items-center gap-2">
					<div className="truncate text-[11px] font-medium">{branch.name}</div>
					<div className="text-[9px] font-mono text-muted-foreground/40">
						{branch.shortSha}
					</div>
				</div>
				<div className="shrink-0 text-[9px] text-muted-foreground/40">
					{branch.lastCommitRelativeDate}
				</div>
			</div>
		</div>
	);
}

export function RemoteRow({ remote }: { remote: GitRemote }) {
	return (
		<div className="px-3 py-1 hover:bg-white/[0.05] transition-colors">
			<div className="text-[11px] font-bold">{remote.name}</div>
			<div className="space-y-0 text-[9px] font-mono text-muted-foreground/60">
				<div className="truncate">
					<span className="opacity-40">f:</span> {remote.fetchUrl ?? "—"}
				</div>
				<div className="truncate">
					<span className="opacity-40">p:</span> {remote.pushUrl ?? "—"}
				</div>
			</div>
		</div>
	);
}

export function StashRow({ stash }: { stash: GitStashEntry }) {
	return (
		<div className="px-3 py-1 hover:bg-white/[0.05] transition-colors cursor-pointer">
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0">
					<div className="truncate text-[11px] font-bold">{stash.name}</div>
					<div className="truncate text-[10px] text-muted-foreground/60">
						{stash.message}
					</div>
				</div>
				<div className="shrink-0 text-[9px] text-muted-foreground/40">
					{stash.relativeDate}
				</div>
			</div>
		</div>
	);
}

function InlineMetric({ label, value }: { label: string; value: number }) {
	return (
		<div className="text-[9px] font-mono text-muted-foreground">
			{label}:{value}
		</div>
	);
}

export function EmptyState({ label }: { label: string }) {
	return (
		<div className="px-3 py-1.5 text-[10px] text-muted-foreground/40 italic">
			{label}
		</div>
	);
}
