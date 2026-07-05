import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import { getSession } from "next-auth/react";

export async function getServerSideProps(context) {
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  return {
    props: { session },
  };
}

export default function Chat() {
  const { data: session } = useSession();
  const router = useRouter();
  
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [useRAG, setUseRAG] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Fetch conversations on load
  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error("Failed to fetch conversations", err);
    }
  };

  const loadConversation = async (id) => {
    setCurrentConversationId(id);
    setMessages([]);
    setIsLoadingChat(true);
    try {
      const res = await fetch(`/api/conversations/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        // Convert DB messages to UI format
        setMessages(data.map(m => ({ role: m.role, content: m.content })));
      }
    } catch (err) {
      console.error("Failed to load messages", err);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const handleNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf" && file.type !== "text/plain") {
      setMessages(prev => [...prev, { role: "assistant", content: "❌ Invalid format! Please upload a PDF or Text (.txt) file." }]);
      e.target.value = ""; // Reset input
      return;
    }

    setSelectedDocument({
      file: file,
      name: file.name
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessages(prev => [...prev, { role: "assistant", content: "❌ Invalid format! Please upload an image file (e.g., JPG, PNG)." }]);
      e.target.value = ""; // Reset input
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage({
        base64: e.target.result.split(',')[1],
        mimeType: file.type,
        previewUrl: e.target.result
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() && !selectedImage && !selectedDocument) return;

    let isRAGEnabled = useRAG;
    const documentToProcess = selectedDocument;
    const imageToProcess = selectedImage;

    const newMessages = [...messages, { 
      role: "user", 
      content: input,
      imagePreview: imageToProcess ? imageToProcess.previewUrl : null,
      documentName: documentToProcess ? documentToProcess.name : null
    }];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    setSelectedImage(null);
    setSelectedDocument(null);

    if (documentToProcess && documentToProcess.file) {
      const formData = new FormData();
      formData.append("file", documentToProcess.file);
      
      try {
        const res = await fetch("/api/documents/ingest", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          isRAGEnabled = true;
          setUseRAG(true);
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: "❌ Failed to process document into database." }]);
          setIsTyping(false);
          return;
        }
      } catch(err) {
        setMessages(prev => [...prev, { role: "assistant", content: "❌ Error processing document." }]);
        setIsTyping(false);
        return;
      }
    }

    const body = {
      messages: newMessages,
      images: imageToProcess ? [ { base64: imageToProcess.base64, mimeType: imageToProcess.mimeType } ] : [],
      useRAG: isRAGEnabled,
      conversationId: currentConversationId
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      // Check for new conversation ID header
      const newConvId = response.headers.get("X-Conversation-Id");
      if (newConvId && newConvId !== currentConversationId) {
        setCurrentConversationId(newConvId);
        fetchConversations(); // refresh sidebar
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let assistantMessage = "";
      setMessages([...newMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const textChunk = decoder.decode(value, { stream: true });
        const lines = textChunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6);
            if (dataStr === '[DONE]') {
               setIsTyping(false);
               break;
            }
            try {
              const data = JSON.parse(dataStr);
              if (data.text) {
                assistantMessage += data.text;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1].content = assistantMessage;
                  return updated;
                });
              }
            } catch (err) {
              console.error("Error parsing JSON chunk", err);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => {
        // Remove empty assistant message if it was added
        const updated = [...prev];
        if (updated.length > 0 && updated[updated.length - 1].content === "") {
          updated.pop();
        }
        return [...updated, { role: "assistant", content: `❌ Error: ${err.message}. Please try again.` }];
      });
      setIsTyping(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      className="min-h-screen relative bg-[#F9FAFB] font-sans text-gray-800 overflow-hidden flex items-center justify-center py-6 px-4"
    >
      
      {/* Global Background Abstract Shapes */}
      <motion.div 
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
      >
        <div className="absolute top-[-10%] left-[40%] w-[30rem] h-[30rem] bg-gradient-to-br from-indigo-100 to-purple-200 rounded-full opacity-70 blur-[2px]"></div>
        <div className="absolute top-0 right-32 w-64 h-32 bg-[#FFA88C] rounded-b-full opacity-90"></div>
        <div className="absolute top-10 -right-20 w-64 h-64 bg-[#F0B3E1] rounded-full opacity-90"></div>
        <div className="absolute bottom-[10%] left-[45%] w-32 h-48 bg-gradient-to-br from-rose-400 to-red-500 rounded-[50px] rounded-tl-[100px] -rotate-12 opacity-90 blur-[1px]"></div>
        <div className="absolute bottom-[10%] left-[45%] w-48 h-48 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
        <div className="absolute bottom-[-5%] right-[20%] w-48 h-48 bg-[#8CD3E5] rounded-bl-full rotate-45 opacity-90"></div>
        <div className="absolute bottom-[20%] right-10 w-48 h-48 bg-[#BCB1F1] rounded-[40px] rotate-[15deg] opacity-90"></div>
      </motion.div>

      {/* Main Container with Sidebar + Chat */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative z-10 w-full max-w-7xl h-[85vh] flex bg-white/80 backdrop-blur-xl border border-white/50 rounded-[2rem] shadow-2xl overflow-hidden"
      >
        
        {/* Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-white/40 border-r border-gray-200/50 flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200/50">
                <button
                  onClick={handleNewChat}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  New Chat
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Previous Chats</h3>
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => loadConversation(conv.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all flex flex-col gap-1 ${currentConversationId === conv.id ? 'bg-indigo-100 text-indigo-900 shadow-inner' : 'hover:bg-white/60 text-gray-600'}`}
                  >
                    <span className="font-medium truncate block w-full">{conv.title}</span>
                    <span className="text-[10px] text-gray-400">{new Date(conv.updatedAt).toLocaleDateString()}</span>
                  </button>
                ))}
                {conversations.length === 0 && (
                  <div className="text-sm text-gray-400 text-center p-4">No recent chats</div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="px-6 py-4 border-b border-gray-200/50 flex justify-between items-center bg-white/40">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div className="relative">
                <span className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
                  Zenith
                </span>
                <div className="w-1.5 h-1.5 bg-pink-500 rounded-full absolute bottom-1 -right-2 shadow-md"></div>
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full ml-2">AI Chat</span>
            </div>

            <div className="flex items-center gap-4">
              <button onClick={() => fileInputRef.current.click()} className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                PDF/Text
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.txt" onChange={handleFileUpload} />
              
              <button onClick={() => imageInputRef.current.click()} className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Image
              </button>
              <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
              
              <label className="text-sm font-medium text-gray-600 flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition">
                <div className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${useRAG ? 'bg-[#7C5FF6]' : 'bg-gray-300'}`}>
                  <div className={`bg-white w-3 h-3 rounded-full shadow-sm transform transition-transform ${useRAG ? 'translate-x-5' : ''}`}></div>
                </div>
                <input type="checkbox" checked={useRAG} onChange={(e) => setUseRAG(e.target.checked)} className="hidden" />
                Use Docs
              </label>

              <div className="w-px h-6 bg-gray-200 mx-2"></div>
              
              <div className="relative group cursor-pointer">
                {session?.user?.image ? (
                  <img src={session.user.image} alt="Profile" className="w-8 h-8 rounded-full border border-gray-200 shadow-sm object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                {/* Dropdown Menu */}
                <div className="absolute right-0 top-full mt-2 w-40 bg-white border border-gray-100 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                    <p className="text-sm font-semibold text-gray-800 truncate">{session?.user?.name || "User"}</p>
                    <p className="text-xs text-gray-500 truncate">{session?.user?.email}</p>
                  </div>
                  <button 
                    onClick={() => signOut()} 
                    className="w-full text-left px-4 py-3 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </header>
          
          {/* Messages Area */}
          <main className="flex-1 overflow-y-auto p-6 space-y-6">
            {isLoadingChat ? (
              <div className="h-full flex flex-col items-center justify-center opacity-50 space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                <p className="text-lg font-medium text-indigo-900">Loading conversation...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-50 space-y-4">
                <svg className="w-16 h-16 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                <p className="text-lg font-medium text-indigo-900">How can I help you today?</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div 
                  key={idx} 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] lg:max-w-[70%] p-5 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-gradient-to-r from-[#7C5FF6] to-[#5b42d1] text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-700 rounded-bl-sm'}`}>
                    {msg.imagePreview && (
                      <img src={msg.imagePreview} alt="Uploaded" className="w-48 h-48 object-cover rounded-lg mb-3 shadow-md border border-white/20" />
                    )}
                    {msg.documentName && (
                      <div className="flex items-center gap-2 bg-white/20 p-3 rounded-lg mb-3 border border-white/10">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <span className="text-sm font-medium text-white truncate max-w-[200px]">{msg.documentName}</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed font-medium">{msg.content}</p>
                  </div>
                </motion.div>
              ))}
              
              {isTyping && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="max-w-xl p-5 rounded-2xl bg-white border border-gray-100 text-gray-400 italic rounded-bl-sm flex gap-1">
                    <span className="animate-bounce">.</span><span className="animate-bounce delay-75">.</span><span className="animate-bounce delay-150">.</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </main>

          {/* Selected Image Preview */}
          {selectedImage && (
            <div className="px-8 pt-4 pb-2 bg-gray-50/80 border-t border-gray-100 flex items-center gap-4">
              <div className="relative group">
                <img src={selectedImage.previewUrl} alt="Selected" className="h-16 w-16 object-cover rounded-xl shadow-sm border border-gray-200" />
                <button type="button" onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition opacity-0 group-hover:opacity-100">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <span className="text-sm font-medium text-gray-500">Image attached</span>
            </div>
          )}

          {/* Selected Document Preview */}
          {selectedDocument && (
            <div className="px-8 pt-4 pb-2 bg-gray-50/80 border-t border-gray-100 flex items-center gap-4">
              <div className="relative group p-3 bg-white border border-gray-200 rounded-xl shadow-sm flex items-center gap-3">
                <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="text-sm font-medium text-gray-700 truncate max-w-[150px]">{selectedDocument.name}</span>
                <button type="button" onClick={() => setSelectedDocument(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition opacity-0 group-hover:opacity-100">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <span className="text-sm font-medium text-gray-500">Document attached</span>
            </div>
          )}

          {/* Input Area */}
          <footer className="p-4 bg-white/60 border-t border-gray-200/50">
            <form onSubmit={handleSubmit} className="flex gap-3 relative">
              <input
                type="text"
                className="flex-1 bg-white border border-gray-200 rounded-2xl px-6 py-4 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all shadow-sm text-gray-800 placeholder-gray-400 font-medium"
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button 
                type="submit" 
                disabled={isTyping || (!input.trim() && !selectedImage && !selectedDocument)} 
                className="bg-gradient-to-r from-[#7C5FF6] to-[#9c89f5] hover:from-[#684be6] hover:to-[#7C5FF6] text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-200/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Send
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </form>
            <div className="text-center mt-2">
              <span className="text-[10px] text-gray-400 font-medium">Zenith AI may produce inaccurate information about people, places, or facts.</span>
            </div>
          </footer>
        </div>
      </motion.div>
    </motion.div>
  );
}
