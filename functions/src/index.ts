import { onRequest } from "firebase-functions/v2/https";
import * as puppeteer from "puppeteer";
import cors from "cors";

const corsHandler = cors({
	origin: ["https://post2image.com", "https://post2image.vercel.app"],
	methods: ["POST"],
	optionsSuccessStatus: 200,
});

export const convertPostToImage = onRequest(
	{
		timeoutSeconds: 60,
		memory: "1GiB", // Increase memory for Puppeteer
	},
	async (req, res) => {
		// Handle CORS
		return corsHandler(req, res, async () => {
			try {
				// Only allow POST methods
				if (req.method !== "POST") {
					return res
						.status(405)
						.json({ message: "Method not allowed" });
				}

				const { link, platform } = req.body;

				if (!link || !platform) {
					return res
						.status(400)
						.json({ message: "Missing required parameters" });
				}

				// Extract post content and convert to image
				const imageUrl = await scrapeAndConvertToImage(link, platform);

				return res.status(200).json({ imageUrl });
			} catch (error) {
				console.error("Error processing request:", error);
				return res.status(500).json({
					message:
						error instanceof Error
							? error.message
							: "An unexpected error occurred",
				});
			}
		});
	}
);

async function scrapeAndConvertToImage(
	link: string,
	platform: string
): Promise<string> {
	// Launch puppeteer browser
	const browser = await puppeteer.launch({
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
		headless: true,
	});

	try {
		const page = await browser.newPage();

		// Set viewport to ensure consistent rendering
		await page.setViewport({ width: 600, height: 800 });

		// Navigate to the link
		await page.goto(link, { waitUntil: "networkidle2", timeout: 30000 });

		// Wait for page to fully render
		await new Promise((resolve) => setTimeout(resolve, 2000));

		let selector: string;

		// Different selectors for different platforms
		if (platform === "X") {
			// Handle X/Twitter post
			selector = 'article[data-testid="tweet"]';
			await page.waitForSelector(selector, { timeout: 10000 });
		} else if (platform === "Instagram") {
			// Handle Instagram post
			selector = 'article[role="presentation"]';
			await page.waitForSelector(selector, { timeout: 10000 });
		} else if (platform === "Threads") {
			// Handle Threads post
			selector = 'div[role="article"]';
			await page.waitForSelector(selector, { timeout: 10000 });
		} else {
			throw new Error(`Unsupported platform: ${platform}`);
		}

		// Take screenshot of the post element
		const element = await page.$(selector);
		if (!element) {
			throw new Error(`Could not find post element on ${platform}`);
		}

		// Screenshot the element
		const buffer = await element.screenshot({
			type: "png",
			omitBackground: false,
		});

		// Convert buffer to base64 data URL
		const imageUrl = `data:image/png;base64,${Buffer.from(buffer).toString(
			"base64"
		)}`;

		return imageUrl;
	} finally {
		await browser.close();
	}
}
