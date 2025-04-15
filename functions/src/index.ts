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

				// Add these new configurations
				await page.setExtraHTTPHeaders({
					'Accept-Language': 'en'
				});

				await page.setUserAgent(
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
				);

				// Increase viewport size
				await page.setViewport({
					width: 1920,
					height: 1080,
					deviceScaleFactor: 2
				});

				// Block unnecessary resources
				await page.setRequestInterception(true);
				page.on('request', (req) => {
					if (req.resourceType() === 'stylesheet' || req.resourceType() === 'font') {
						req.abort();
					} else {
						req.continue();
					}
				});

				await page.goto(link, {
					waitUntil: "networkidle2",
					timeout: 100000,
				});

				// Add before the switch statement
				if (platform === "Instagram" || platform === "Facebook") {
					await page.evaluate(() => {
						const cookies = document.querySelector('[data-testid="cookie-policy-dialog"]');
						if (cookies) {
							cookies.remove();
						}
					});
				}

				switch (platform) {
					case "X":
						await page.waitForSelector(
							'article[data-testid="tweet"]',
							{
								timeout: 100000,
								visible: true
							}
						);
						break;
					case "Instagram":
							// First remove login popup
							await page.evaluate(() => {
									// Remove login dialog
									const loginDialog = document.querySelector('div._ac4d');
									if (loginDialog) {
											loginDialog.remove();
									}
									// Remove cookie notice if present
									const cookieNotice = document.querySelector('div._ab8w');
									if (cookieNotice) {
											cookieNotice.remove();
									}
							});
							// Wait for post content
							await page.waitForSelector(
									'div._aam1', // Main post container
									{
											timeout: 100000,
											visible: true
									}
							);
							break;
					case "Threads":
							await page.evaluate(() => {
									// Remove any modals or overlays
									const overlays = document.querySelectorAll('[role="dialog"]');
									overlays.forEach(overlay => overlay.remove());
							});
							// Wait for main post content
							await page.waitForSelector(
									'[role="main"] div.x1ypdohk', // Main post container
									{
											timeout: 100000,
											visible: true
									}
							);
							break;
					case "Facebook":
							await page.waitForSelector(
									'div.x1lliihq', // Facebook post container
									{
											timeout: 100000,
											visible: true
									}
							);
							break;
					case "TikTok":
							await page.waitForSelector(
									'div.tiktok-1y6genuq-DivBrowserModeContainer', // TikTok post container
									{
											timeout: 100000,
											visible: true
									}
							);
							break;
					default:
							throw new Error("Unsupported platform");
				}

				// Add this before taking screenshot for X/Twitter
				if (platform === "X") {
					await page.evaluate(() => {
							// Simpler approach to remove blur and banners
							const style = document.createElement('style');
							style.innerHTML = `
									/* Remove all blur effects */
									* {
											filter: none !important;
											-webkit-filter: none !important;
									}
									
									/* Hide all promotional banners and login prompts */
									div[data-testid="inlinePrompt"],
									div[data-testid="loggedOutHome"],
									div[data-testid="TopNavBar"] {
											display: none !important;
									}
							`;
							document.head.appendChild(style);
					});
					
					// Wait for styles to apply
					await new Promise(resolve => setTimeout(resolve, 1000));
				}

				let element;
				if (platform === "X") {
					element = await page.$('article[data-testid="tweet"]');
				} else if (platform === "Instagram") {
					element = await page.$('div._aam1'); // Updated Instagram container
				} else if (platform === "Threads") {
					element = await page.$('[role="main"] div.x1ypdohk'); // Updated Threads container
				} else if (platform === "Facebook") {
					element = await page.$('div.x1lliihq'); // Updated Facebook container
				} else if (platform === "TikTok") {
					element = await page.$('div.tiktok-1y6genuq-DivBrowserModeContainer'); // Updated TikTok container
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

				res.status(200).json({ imageUrl, platform });
				return;
			} catch (error) {
				console.error("Error converting post:", error);
				res.status(500).json({ message: "Failed to convert post" });
				return;
			}
		});
	}
);
