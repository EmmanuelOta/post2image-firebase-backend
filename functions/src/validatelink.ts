// functions/src/validateLink.ts
export function validateLink(link: string): {
	isValid: boolean;
	platform: string | null;
} {
	try {
		const url = new URL(link);
		url.hostname.replace(/^www\.|^m\./, "");
		const pathname = url.pathname;

		const platformPatterns: { [key: string]: RegExp } = {
			X: /^\/[A-Za-z0-9_]+\/status\/\d+\/?$/,
			Instagram: /^\/p\/[A-Za-z0-9_-]+\/?$/,
			Threads: /^\/t\/[A-Za-z0-9_-]+\/?$/,
			TikTok: /^\/@[\w.-]+\/video\/\d+\/?$/,
			Facebook:
				/^\/(?:photo\.php\?fbid=\d+|permalink\.php\?story_fbid=\d+&id=\d+|[\w.-]+\/posts\/\d+|groups\/\d+\/permalink\/\d+)\/?$/,
		};

		for (const [platform, pattern] of Object.entries(platformPatterns)) {
			if (pattern.test(pathname)) {
				return { isValid: true, platform };
			}
		}

		return { isValid: false, platform: null };
	} catch (err) {
		return { isValid: false, platform: null };
	}
}
