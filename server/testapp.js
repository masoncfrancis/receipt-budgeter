import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";


// load .env.production when NODE_ENV=production, otherwise .env.local
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const ai = new GoogleGenAI({});

async function main() {

  const ai = new GoogleGenAI({});
  const base64ImageFile = fs.readFileSync("path/to/small-sample.jpg", {
    encoding: "base64",
  });

  const contents = [
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: base64ImageFile,
      },
    },
    { text: "Caption this image." },
  ];

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: contents,
  });
  console.log(response.text);
}

await main();