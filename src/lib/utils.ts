import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const MIDDLE_CLICK_CLOSE_IGNORE_SELECTOR = [
	"button",
	"a",
	"input",
	"textarea",
	"select",
	"summary",
	'[role="button"]',
	'[role="link"]',
	'[role="menuitem"]',
	'[contenteditable="true"]',
	"[data-middle-click-close-ignore]",
].join(", ");

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function shouldHandleMiddleClickClose(event: {
	button: number;
	defaultPrevented: boolean;
	target: EventTarget | null;
}) {
	if (event.defaultPrevented || event.button !== 1) {
		return false;
	}

	if (!(event.target instanceof Element)) {
		return true;
	}

	return !event.target.closest(MIDDLE_CLICK_CLOSE_IGNORE_SELECTOR);
}
