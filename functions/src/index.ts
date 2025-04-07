import * as functions from "firebase-functions";
import * as puppeteer from "puppeteer";
import { Request, Response } from "express";
import cors from "cors";
//import { validateLink } from "./validatelink";

const corsHandler = cors({
	origin: [
		"https://post2image.vercel.app",
		"https://post2image.com",
		"http://localhost:3000", // for local development
	],
	methods: ["POST"],
	credentials: true,
});

export const convertPost = functions.https.onRequest(
	{
		memory: "1GiB",
		timeoutSeconds: 120,
	},
	async (req: Request, res: Response) => {
		corsHandler(req, res, async () => {
			if (req.method !== "POST") {
				res.status(405).json({ message: "Method not allowed" });
				return;
			}

			try {
				const { link, platform } = req.body;

				/** 
				 * //validate the link again on the server side
				const validation = validateLink(link);
				if (!validation.isValid) {
					res.status(400).json({ message: "Invalid link" });
					return;
				}
				*/

				const browser = await puppeteer.launch({
					headless: true,
					args: [
						"--no-sandbox",
						"--disable-setuid-sandbox",
						"--disable-dev-shm-usage",
						"--disable-accelerated-2d-canvas",
						"--no-first-run",
						"--no-zygote",
						"--disable-gpu",
					],
				});

				const page = await browser.newPage();

				await page.setUserAgent(
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
						"(KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36"
				);

				await page.setViewport({ width: 600, height: 800 });
				await page.goto(link, {
					waitUntil: "networkidle2",
					timeout: 60000,
				});

				switch (platform) {
					case "X":
						await page.waitForSelector(
							'article[data-testid="tweet"]',
							{
								timeout: 60000,
							}
						);
						break;
					case "Instagram":
						await page.waitForSelector(
							'article[role="presentation"]',
							{
								timeout: 60000,
							}
						);
						break;
					case "Threads":
						await page.waitForSelector("article", {
							timeout: 60000,
						});
						break;
					case "Facebook":
						await page.waitForSelector(
							'[data-testid="post_message"]',
							{
								timeout: 60000,
							}
						);
						break;
					case "TikTok":
						await page.waitForSelector(
							".tiktok-1rgp3yt-DivItemContainer",
							{ timeout: 60000 }
						);
						break;
					default:
						throw new Error("Unsupported platform");
				}

				let element;
				if (platform === "X") {
					element = await page.$('article[data-testid="tweet"]');
				} else if (platform === "Instagram") {
					element = await page.$('article[role="presentation"]');
				} else if (platform === "Threads") {
					element = await page.$("article");
				}

				if (!element) {
					await browser.close();
					res.status(404).json({ message: "Post element not found" });
					return;
				}

				const screenshot = (await element?.screenshot({
					type: "png",
				})) as Buffer;
				const base64Image = Buffer.from(screenshot).toString("base64");
				const imageUrl = `data:image/png;base64,${base64Image}`;

				await browser.close();

				res.status(200).json({ imageUrl });
				return;
			} catch (error) {
				console.error("Error converting post:", error);
				res.status(500).json({ message: "Failed to convert post" });
				return;
			}
		});
	}
);
