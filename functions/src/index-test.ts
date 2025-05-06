import express, { Request, Response } from "express";
import cors from "cors";
import { onRequest } from "firebase-functions/v2/https";
import puppeteer from "puppeteer";

const app = express();

// --- CORS middleware
app.use(
	cors({
		origin: (origin, callback) => {
			const allowedOrigins = [
				"https://post2image.com",
				"https://post2image.vercel.app",
			];
			if (!origin || allowedOrigins.includes(origin)) {
				callback(null, true);
			} else {
				callback(new Error("Not allowed by CORS"));
			}
		},
		credentials: true,
	})
);

// --- Middleware to parse JSON
app.use(express.json());

// --- POST route
app.post("/", async (req: Request, res: Response) => {
	const { link, platform } = req.body as { link?: string; platform?: string };

	if (!link || !platform) {
		return res.status(400).json({ error: "Missing link or platform." });
	}

	let browser;
	try {
		browser = await puppeteer.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});

		const page = await browser.newPage();

		// Set a user-agent to reduce popups
		await page.setUserAgent(
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
		);

		// Navigate to the link
		await page.goto(link, { waitUntil: "networkidle2", timeout: 60000 });

		// Wait some time to ensure full render
		await new Promise((resolve) => setTimeout(resolve, 3000));

		// Determine selector based on platform
		let selector: string;
		switch (platform.toLowerCase()) {
			case "x":
				selector = "article"; // Full tweet container
				break;
			case "threads":
				selector = "article"; // For now, same
				break;
			case "instagram":
				selector = "article"; // Instagram post container
				break;
			default:
				await browser.close();
				res.status(400).json({ error: "Invalid platform specified." });
				return;
		}

		// Wait for the post element
		await page.waitForSelector(selector, { timeout: 10000 });

		const postElement = await page.$(selector);

		if (!postElement) {
			await browser.close();
			res.status(404).json({ error: "Post element not found." });
			return;
		}

		// Screenshot only the post element
		const buffer = await postElement.screenshot({ type: "png" });

		// Encode it to base64
		const base64Image = `data:image/png;base64,${Buffer.from(
			buffer
		).toString("base64")}`;

		await browser.close();

		return res.status(200).json({ imageUrl: base64Image });
	} catch (error) {
		console.error("Error generating image:", error);
		if (browser) await browser.close();
		res.status(500).json({ error: "Something went wrong." });
		return;
	}
});

// --- Export the function
export const post2image = onRequest(
	{
		timeoutSeconds: 180, // 3 minutes
		memory: "512MiB", // Give enough memory for Puppeteer
	},
	app
);
