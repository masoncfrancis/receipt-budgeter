import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";

// load .env.production when NODE_ENV=production, otherwise .env.local
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const ai = new GoogleGenAI({});

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-lite",
    contents: "Share how to handle budgeting in a marriage in a few words",
  });
  console.log(response.text);
}

await main();