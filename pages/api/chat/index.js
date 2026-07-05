import { streamChatWithAI } from "../../../lib/ai";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // For images
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { messages, useRAG, images, conversationId } = req.body;
    const lastUserMessage = messages[messages.length - 1].content;

    let currentConversationId = conversationId;

    if (!currentConversationId) {
      let generatedTitle = "New Chat";
      if (lastUserMessage) {
        try {
          const titleModel = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
          const titlePrompt = `Generate a 2-3 word summary title for this message. Reply with ONLY the title. Message: "${lastUserMessage}"`;
          const titleResult = await titleModel.generateContent(titlePrompt);
          const text = titleResult.response.text().trim().replace(/["']/g, '');
          if (text) generatedTitle = text;
        } catch (err) {
          console.error("Title generation error:", err);
        }
      }

      const newConv = await prisma.conversation.create({
        data: {
          userId: session.user.id,
          title: generatedTitle,
        }
      });
      currentConversationId = newConv.id;
    }

    // Save user's message
    await prisma.message.create({
      data: {
        conversationId: currentConversationId,
        role: "user",
        content: lastUserMessage || (images ? "[Image attached]" : "")
      }
    });

    let finalMessages = [...messages];
    let systemPrompt = "You are a helpful and smart AI assistant. Use a friendly tone and include lots of emojis naturally throughout your response. DO NOT use any markdown formatting like asterisks (**), hashes (###), or bullet points. Provide plain text only.";

    // Handle images
    if (images && images.length > 0) {
      finalMessages[finalMessages.length - 1] = {
        role: 'user',
        content: lastUserMessage || "Please review the attached image.",
        images: images // passing base64 images array
      };
      systemPrompt = "You are a helpful visual assistant. Analyze any images provided carefully and answer questions about them. Use a friendly tone and include lots of emojis naturally throughout your response. DO NOT use any markdown formatting like asterisks (**), hashes (###), or bullet points. Provide plain text only.";
    }

    // Handle RAG (Document search) — only if user sent a non-empty text query
    if (useRAG && lastUserMessage && lastUserMessage.trim()) {
      const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
      const result = await embeddingModel.embedContent(lastUserMessage);
      const queryVector = `[${result.embedding.values.join(",")}]`;

      // Perform vector search
      const similarDocs = await prisma.$queryRawUnsafe(`
        SELECT title, content, 1 - (embedding <=> $1::vector) as similarity
        FROM "Document"
        ORDER BY embedding <=> $1::vector
        LIMIT 5
      `, queryVector);

      if (similarDocs.length > 0) {
        let contextStr = "<context>\n";
        similarDocs.forEach((doc, i) => {
          contextStr += `[Source ${i+1}: ${doc.title}]\n${doc.content}\n\n`;
        });
        contextStr += "</context>\n\n";

        systemPrompt = "You are an assistant answering questions based strictly on the provided context. If the context does not contain the answer, say you do not have that information rather than guessing. Always cite the source document when possible. Use a friendly tone and include lots of emojis naturally throughout your response. DO NOT use any markdown formatting like asterisks (**), hashes (###), or bullet points. Provide plain text only.";
        
        finalMessages[finalMessages.length - 1] = {
          role: "user",
          content: `${contextStr}Question: ${lastUserMessage}`
        };
      }
    }

    // Stream back the response
    const onComplete = async (fullResponse) => {
      await prisma.message.create({
        data: {
          conversationId: currentConversationId,
          role: "assistant",
          content: fullResponse
        }
      });
    };
    
    // Pass the conversation ID back via an initial event if needed, but it's simpler to just return it in a header or let the client query it.
    // Actually, SSE headers are sent in streamChatWithAI. We can pass conversationId back by setting a header before calling it.
    res.setHeader("X-Conversation-Id", currentConversationId);
    
    await streamChatWithAI(finalMessages, systemPrompt, res, onComplete);
  } catch (error) {
    console.error("Chat API Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
}
