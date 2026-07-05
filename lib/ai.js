import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function streamChatWithAI(messages, systemPrompt, res, onComplete) {
  // Use Gemini 1.5 Pro or Flash. Flash is great for speed.
  const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    systemInstruction: systemPrompt || "You are a helpful assistant.",
  });

  // Convert generic message format ({role, content}) to Gemini format
  const history = messages.slice(0, -1).map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const lastMessage = messages[messages.length - 1];
  const chat = model.startChat({ history });

  let resultStream;
  if (lastMessage.images && lastMessage.images.length > 0) {
    // Multimodal input
    const parts = [{ text: lastMessage.content || "Please review the attached image." }];
    
    lastMessage.images.forEach(img => {
      parts.push({
        inlineData: {
          data: img.base64,
          mimeType: img.mimeType,
        },
      });
    });
    
    resultStream = await chat.sendMessageStream(parts);
  } else {
    // Text only
    resultStream = await chat.sendMessageStream(lastMessage.content);
  }

  // Set SSE Headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.on('close', () => {
    // Handle client disconnect gracefully
    res.end();
  });

  let fullResponse = "";
  try {
    for await (const chunk of resultStream.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
    }
  } catch (err) {
    console.error("Streaming error:", err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  }

  res.write("data: [DONE]\n\n");
  res.end();
  
  if (onComplete) {
    await onComplete(fullResponse);
  }
}
