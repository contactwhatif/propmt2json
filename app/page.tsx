"use client";
import { useState } from "react";
import { FaGithub, FaComment } from "react-icons/fa";
import Image from "next/image";

// Initialize Supabase client (kept for potential future use, but not used here)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | {
    sentiment: string;
    intent: string;
    requirements: string;
    expectations: string;
    structured: string;
  }>(null);
  const [userPrompt, setUserPrompt] = useState("");
  const [notification, setNotification] = useState<{ message: string; type: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userPrompt.trim()) {
      showNotification("Please enter a prompt", "error");
      setLoading(false);
      return;
    }
    setLoading(true);
    setResult(null);
    const form = new FormData(e.target as HTMLFormElement);
    const promptType = form.get("promptType");
    const outputFormat = form.get("outputFormat");

    try {
      const res = await fetch("/api/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptType, outputFormat, userPrompt }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `API request failed with status ${res.status}`);
      }
      if (!data.aiResponse) {
        throw new Error("No AI response received");
      }
      const parsedResult = parseResponse(data.aiResponse, outputFormat as string);
      setResult(parsedResult);
    } catch (err) {
      console.error("Error in handleSubmit:", err);
      if (err instanceof Error) {
        showNotification(err.message, "error");
      } else {
        showNotification("An unknown error occurred", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const parseResponse = (aiResponse: string, outputFormat: string) => {
    try {
      const sentimentMatch = aiResponse.match(/SENTIMENT:\s*([^]*?)(?=\nINTENT:|$)/);
      const intentMatch = aiResponse.match(/INTENT:\s*([^]*?)(?=\nREQUIREMENTS:|$)/);
      const requirementsMatch = aiResponse.match(/REQUIREMENTS:\s*([^]*?)(?=\nEXPECTATIONS:|$)/);
      const expectationsMatch = aiResponse.match(/EXPECTATIONS:\s*([^]*?)(?=\nSTRUCTURED_[^:]+|$)/);
      const structuredMatch = aiResponse.match(new RegExp(`STRUCTURED_${outputFormat.toUpperCase()}:\\s*([^]*)`, 's'));
      
      return {
        sentiment: sentimentMatch?.[1]?.trim() || "Not detected",
        intent: intentMatch?.[1]?.trim() || "Not detected",
        requirements: requirementsMatch?.[1]?.trim() || "Not detected",
        expectations: expectationsMatch?.[1]?.trim() || "Not detected",
        structured: structuredMatch?.[1]?.trim() || "No structured output generated"
      };
    } catch (err) {
      console.error("Error parsing AI response:", err);
      return {
        sentiment: "Error parsing response",
        intent: "Error parsing response",
        requirements: "Error parsing response",
        expectations: "Error parsing response",
        structured: "Error parsing response"
      };
    }
  };

  const showNotification = (message: string, type: string) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const copyToClipboard = () => {
    if (result?.structured) {
      navigator.clipboard.writeText(result.structured);
      showNotification("Structured output copied!", "success");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="container mx-auto px-4 py-4 max-w-7xl">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-700">
                AI Prompt Structurer
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-sm md:text-base mt-1">
                Transform prompts into structured outputs with AI analysis
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300 bg-blue-50 dark:bg-gray-800 px-3 py-1 rounded-full">
                Enterprise Solution
              </span>
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
              
              {/* GitHub Repository Link */}
              <a 
                href="https://github.com/yourusername/ai-prompt-structurer" 
                target="_blank" 
                className="p-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors"
                title="View on GitHub"
              >
                <FaGithub />
              </a>
              
              {/* Feedback Button */}
              <button 
                onClick={() => setShowFeedbackModal(true)}
                className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-colors"
                title="Send Feedback"
              >
                <FaComment />
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex gap-8 h-[80vh]">
          {/* Left scrollable form + results */}
          <div className="flex-[0.7] relative overflow-y-auto pr-2">
            {loading && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-xl">
                <div className="text-center">
                  <div className="w-16 h-16 border-t-4 border-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-xl text-white font-medium">Analyzing your prompt...</p>
                  <p className="text-gray-300 mt-2">This may take a few moments</p>
                </div>
              </div>
            )}
            {/* Prompt Form */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Prompt Configuration</h2>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div>
                  <label className="block text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Prompt Type</label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer border-2 border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                      <input type="radio" name="promptType" value="text" defaultChecked className="mr-3 h-4 w-4 text-blue-600" />
                      <span className="font-medium text-gray-700 dark:text-gray-300">Text</span>
                    </label>
                    <label className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer border-2 border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                      <input type="radio" name="promptType" value="image" className="mr-3 h-4 w-4 text-blue-600" />
                      <span className="font-medium text-gray-700 dark:text-gray-300">Image</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Output Format</label>
                  <div className="grid grid-cols-3 gap-4">
                    {["json", "markdown", "xml"].map((format) => (
                      <label key={format} className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer border-2 border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                        <input type="radio" name="outputFormat" value={format} defaultChecked={format === "json"} className="mr-3 h-4 w-4 text-blue-600" />
                        <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">{format}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Your Prompt</label>
                  <textarea
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    rows={5}
                    className="w-full bg-gray-50 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-lg p-4 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    placeholder="Enter your prompt here..."
                  />
                </div>
                
                <div className="flex justify-center pt-2">
                  <button type="submit" className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg font-bold shadow-lg hover:opacity-90 transition-all transform hover:scale-[1.02]">
                    Structure My Prompt
                  </button>
                </div>
              </form>
            </div>
            
            {/* Results */}
            {result && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-700 dark:to-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">Prompt Analysis Results</h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="p-5 rounded-lg border border-gray-200 dark:border-gray-600 bg-blue-50 dark:bg-gray-700 shadow-sm">
                      <h3 className="text-blue-600 dark:text-blue-400 font-bold mb-2 flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                        Sentiment
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{result.sentiment}</p>
                    </div>
                    <div className="p-5 rounded-lg border border-gray-200 dark:border-gray-600 bg-green-50 dark:bg-gray-700 shadow-sm">
                      <h3 className="text-green-600 dark:text-green-400 font-bold mb-2 flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                        Intent
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{result.intent}</p>
                    </div>
                    <div className="p-5 rounded-lg border border-gray-200 dark:border-gray-600 bg-amber-50 dark:bg-gray-700 shadow-sm">
                      <h3 className="text-amber-600 dark:text-amber-400 font-bold mb-2 flex items-center">
                        <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span>
                        Requirements
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{result.requirements}</p>
                    </div>
                    <div className="p-5 rounded-lg border border-gray-200 dark:border-gray-600 bg-purple-50 dark:bg-gray-700 shadow-sm">
                      <h3 className="text-purple-600 dark:text-purple-400 font-bold mb-2 flex items-center">
                        <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                        Expectations
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{result.expectations}</p>
                    </div>
                  </div>
                  
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                    <div className="flex justify-between items-center px-4 py-3 bg-gradient-to-r from-gray-800 to-gray-900 dark:from-gray-700 dark:to-gray-800">
                      <h3 className="text-white font-bold flex items-center">
                        <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></span>
                        Structured Output
                      </h3>
                      <button
                        onClick={copyToClipboard}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-500 transition flex items-center"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </button>
                    </div>
                    <pre className="bg-gray-900 text-green-400 p-5 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto font-mono">
                      {result.structured}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="flex-[0.3]">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 h-full overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-6 text-white">
                <div className="flex items-center">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-lg">
                    <Image
                      src="https://i.ibb.co/7x73HBx7/Whats-App-Image-2025-06-21-at-21-58-01-d6042a8a.jpg"
                      alt="Profile"
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                      priority
                    />
                  </div>
                  <div className="ml-4">
                    <h2 className="text-xl font-bold">Siva Sakthi</h2>
                    <p className="text-indigo-200">Digital Marketing Specialist</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 flex-grow overflow-y-auto">
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-3 text-gray-800 dark:text-gray-200 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    About Me
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      Passionate about leveraging AI tools to enhance marketing strategies and create compelling content. 
                      With 1+ years of experience in digital marketing, I specialize in SEO, content creation, and data-driven campaigns.
                    </p>
                  </div>
                </div>
                
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-3 text-gray-800 dark:text-gray-200 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Skills
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {["SEO", "Content Strategy", "Data Analysis", "Machine Learning", "AI Tools"].map((skill) => (
                      <span key={skill} className="px-3 py-1 bg-blue-50 dark:bg-gray-700 rounded-full text-xs font-medium text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Social Media Box */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <h3 className="text-lg font-bold mb-3 text-gray-800 dark:text-gray-200 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a9.001 9.001 0 010-5.684m-9.032 5.684a9.001 9.001 0 01-5.684 0m14.716 0a3 3 0 11-5.684 0" />
                    </svg>
                    Connect With Me
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <a href="https://www.linkedin.com/in/siva-sakthi-aa4b6726b/" target="_blank" className="flex items-center justify-center p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">
                      <FaLinkedinIn className="mr-2" />
                      <span className="text-sm font-medium">LinkedIn</span>
                    </a>
                    <a href="https://wa.me/918148823426" target="_blank" className="flex items-center justify-center p-3 bg-green-500 text-white rounded-lg hover:bg-green-400 transition-colors">
                      <FaWhatsapp className="mr-2" />
                      <span className="text-sm font-medium">WhatsApp</span>
                    </a>
                    <a href="https://github.com/contactwhatif" target="_blank" className="flex items-center justify-center p-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors">
                      <FaGithub className="mr-2" />
                      <span className="text-sm font-medium">GitHub</span>
                    </a>
                    <a href="#" target="_blank" className="flex items-center justify-center p-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity">
                      <FaInstagram className="mr-2" />
                      <span className="text-sm font-medium">Instagram</span>
                    </a>
                  </div>
                </div>
              </div>
              
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">© 2025 JDDeveloper.com. All rights reserved.</p>
              </div>
            </div>
          </div>
        </div>
        
        {notification && (
          <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 flex items-center ${notification.type === "error" ? "bg-red-600" : "bg-green-600"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={notification.type === "error" ? "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" : "M5 13l4 4L19 7"} />
            </svg>
            {notification.message}
          </div>
        )}
        
        {/* Feedback Modal */}
        {showFeedbackModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">Send Feedback</h3>
                  <button 
                    onClick={() => setShowFeedbackModal(false)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <form onSubmit={(e) => { e.preventDefault(); setShowFeedbackModal(false); showNotification("Thank you for your feedback!", "success"); }}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Your Feedback
                    </label>
                    <textarea
                      rows={4}
                      className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="What do you think about our service?"
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowFeedbackModal(false)}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Send Feedback
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
