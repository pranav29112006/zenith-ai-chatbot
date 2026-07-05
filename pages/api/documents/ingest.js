import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import formidable from "formidable";
import fs from "fs";

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const config = {
  api: {
    bodyParser: false,
  },
};

// Chunk text into blocks of ~500 chars with some overlap
function chunkText(text, chunkSize = 500, overlap = 100) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const form = formidable({});

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve({ fields, files });
      });
    });

    const fileArray = Array.isArray(files.file) ? files.file : [files.file];
    
    let totalChunks = 0;

    for (const file of fileArray) {
      if (!file) continue;

      let text = "";
      if (file.mimetype === "application/pdf") {
        const dataBuffer = fs.readFileSync(file.filepath);
        const pdfParse = require("pdf-parse");
        const data = await pdfParse(dataBuffer);
        text = data.text;
      } else {
        // Parse basic text files
        text = fs.readFileSync(file.filepath, "utf8");
      }

      if (!text) continue;

      const chunks = chunkText(text);

      const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

      for (const chunk of chunks) {
        if (!chunk.trim()) continue;

        // Generate embedding
        const result = await embeddingModel.embedContent(chunk);
        const embedding = result.embedding.values;

        // Ensure we format the embedding as a pgvector string '[0.1, 0.2, ...]'
        const vectorString = `[${embedding.join(",")}]`;

        // Save to DB using Raw SQL for pgvector
        await prisma.$executeRawUnsafe(
          `INSERT INTO "Document" (id, title, content, embedding, "createdAt") 
           VALUES (gen_random_uuid(), $1, $2, $3::vector, NOW())`,
          file.originalFilename,
          chunk,
          vectorString
        );

        totalChunks++;
      }
    }

    res.status(200).json({ message: "Ingestion complete", chunks: totalChunks });
  } catch (error) {
    console.error("Ingest Error:", error);
    res.status(500).json({ error: error.message || "Failed to ingest document" });
  }
}
