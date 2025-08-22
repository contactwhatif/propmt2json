"use client";
import { useState, useEffect } from "react";
import { FaLinkedinIn, FaWhatsapp, FaGithub, FaInstagram, FaComment, FaSignOutAlt, FaUser, FaTimes, FaCheck } from "react-icons/fa";
// import { useTheme } from "next-themes";
import { createClient } from '@supabase/supabase-js';
import Image from "next/image";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  // const { theme, setTheme } = useTheme();
  
  // Authentication states
  interface SupabaseSession {
    user: {
      id: string;
      email?: string;
      user_metadata?: {
        industry?: string;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [email, setEmail] = useState("");
  const [industry, setIndustry] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showIndustryForm, setShowIndustryForm] = useState(false);
  
  // Feedback states
  const [feedback, setFeedback] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Check for existing session on component mount
  useEffect(() => {
    const getSession = async () => {
      setLoadingSession(true);
      try {
        // First check localStorage
        const savedSession = localStorage.getItem('supabaseSession');
        if (savedSession) {
          try {
            const parsedSession = JSON.parse(savedSession);
            setSession(parsedSession);
          } catch (e) {
            console.error('Error parsing saved session:', e);
            localStorage.removeItem('supabaseSession');
          }
        }
        // Then check with Supabase
        const { data: { session: supaSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          showNotification('Failed to fetch session from Supabase.', 'error');
        }
        if (supaSession) {
          // Map Supabase Session.User to local SupabaseSession type
          const mappedSession: SupabaseSession = {
            ...supaSession,
            user: {
              ...supaSession.user,
              email: supaSession.user.email,
            }
          };
          setSession(mappedSession);
          localStorage.setItem('supabaseSession', JSON.stringify(mappedSession));
          // Check if user has industry set
          if (!supaSession.user.user_metadata?.industry) {
            setShowIndustryForm(true);
          }
          // Upsert user data to profiles table (insert or update)
          try {
            const { error: upsertError } = await supabase
              .from('profiles')
              .upsert([
                {
                  id: supaSession.user.id,
                  email: supaSession.user.email ?? '',
                  industry: supaSession.user.user_metadata?.industry || ''
                }
              ], { onConflict: 'id' });
            if (upsertError) {
              showNotification('Error saving user profile.', 'error');
              console.error('Error upserting user profile:', upsertError);
            }
          } catch (error) {
            showNotification('Error saving user profile.', 'error');
            console.error('Error upserting user profile:', error);
          }
        }
      } catch (err) {
        showNotification('An error occurred while loading session.', 'error');
        console.error('Session load error:', err);
      } finally {
        setLoadingSession(false);
      }
    };
    
    getSession();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, authSession) => {
        console.log("Auth state changed:", event, authSession);
        if (authSession) {
          const mappedSession: SupabaseSession = {
            ...authSession,
            user: {
              ...authSession.user,
              email: authSession.user.email,
            }
          };
          setSession(mappedSession);
          localStorage.setItem('supabaseSession', JSON.stringify(mappedSession));
          // Check if user has industry set
          if (!authSession.user.user_metadata?.industry) {
            setShowIndustryForm(true);
          }
          // Upsert user data to profiles table (insert or update)
          try {
            const { error: upsertError } = await supabase
              .from('profiles')
              .upsert([
                {
                  id: authSession.user.id,
                  email: authSession.user.email ?? '',
                  industry: authSession.user.user_metadata?.industry || ''
                }
              ], { onConflict: 'id' });
            if (upsertError) {
              console.error('Error upserting user profile:', upsertError);
            }
          } catch (error) {
            console.error('Error upserting user profile:', error);
          }
        } else {
          setSession(null);
          localStorage.removeItem('supabaseSession');
          setShowIndustryForm(false);
        }
        setLoadingSession(false);
      }
    );
    
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!session) {
      showNotification("Please log in to generate structured output.", "error");
      return;
    }
    if (!userPrompt.trim()) {
      showNotification("Please enter a prompt", "error");
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
      if (data.error) throw new Error(data.error);
      setResult(parseResponse(data.aiResponse, outputFormat as string));
    } catch (err) {
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
    // Fixed regex patterns by removing the 's' flag and using [\s\S] instead
    const sentimentMatch = aiResponse.match(/SENTIMENT:\s*([\s\S]+?)(?=\nINTENT:|$)/);
    const intentMatch = aiResponse.match(/INTENT:\s*([\s\S]+?)(?=\nREQUIREMENTS:|$)/);
    const requirementsMatch = aiResponse.match(/REQUIREMENTS:\s*([\s\S]+?)(?=\nEXPECTATIONS:|$)/);
    const expectationsMatch = aiResponse.match(/EXPECTATIONS:\s*([\s\S]+?)(?=\nSTRUCTURED_|$)/);
    const structuredMatch = aiResponse.match(new RegExp(`STRUCTURED_${outputFormat.toUpperCase()}:\\s*([\\s\\S]+)`));
    return {
      sentiment: sentimentMatch?.[1] || "Not detected",
      intent: intentMatch?.[1] || "Not detected",
      requirements: requirementsMatch?.[1] || "Not detected",
      expectations: expectationsMatch?.[1] || "Not detected",
      structured: structuredMatch?.[1] || "No structured output generated"
    };
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

  // Handle authentication - unified for login and signup
  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthLoading(true);
    
    try {
      // Send magic link for both login and signup
      const { error } = await supabase.auth.signInWithOtp({ 
        email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      
      if (error) throw error;
      
      showNotification("Check your email for the login link!", "success");
      setEmailSent(true);
      
      // Close modal after 3 seconds
      setTimeout(() => {
        setShowAuthModal(false);
        setEmailSent(false);
      }, 3000);
    } catch (error) {
      if (error instanceof Error) {
        showNotification(error.message, "error");
      } else {
        showNotification("An unknown error occurred", "error");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    localStorage.removeItem('supabaseSession');
    setShowIndustryForm(false);
    showNotification("Logged out successfully", "success");
  };

  // Handle industry update
  const handleIndustryUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!industry.trim()) {
      showNotification("Please enter your industry", "error");
      return;
    }
    
    try {
      // Update user metadata
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { industry }
      });
      
      if (metadataError) throw metadataError;
      
      // Update profiles table
      if (session) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ industry })
          .eq('id', session.user.id);
        if (profileError) throw profileError;
        // Update local session
        const updatedSession = {
          ...session,
          user: {
            ...session.user,
            user_metadata: {
              ...session.user.user_metadata,
              industry
            }
          }
        };
        setSession(updatedSession);
        localStorage.setItem('supabaseSession', JSON.stringify(updatedSession));
        setShowIndustryForm(false);
        setIndustry("");
        showNotification("Industry updated successfully!", "success");
      }
    } catch (error) {
      if (error instanceof Error) {
        showNotification(error.message, "error");
      } else {
        showNotification("An unknown error occurred", "error");
      }
    }
  };

  // Handle feedback submission
  const handleFeedbackSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!feedback.trim()) {
      showNotification("Please enter your feedback", "error");
      return;
    }
    
    setFeedbackLoading(true);
    
    try {
      // Save feedback to Supabase
      const { error } = await supabase
        .from('feedback')
        .insert([
          { 
            content: feedback,
            user_email: session?.user?.email || 'anonymous',
            created_at: new Date().toISOString()
          }
        ]);
      
      if (error) {
        console.log('Feedback submission failed:', error);
        showNotification("Thank you for your feedback!", "success");
      } else {
        showNotification("Thank you for your feedback!", "success");
      }
      
      setFeedback("");
      setShowFeedbackModal(false);
    } catch (error) {
      console.log('Error submitting feedback:', error);
      showNotification("Thank you for your feedback!", "success");
      setFeedback("");
      setShowFeedbackModal(false);
    } finally {
      setFeedbackLoading(false);
    }
  };

  // Open auth modal and reset form
  const openAuthModal = () => {
    setEmail("");
    setEmailSent(false);
    setShowAuthModal(true);
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
              
              {/* Feedback Button - only when logged in */}
              {session && (
                <button 
                  onClick={() => setShowFeedbackModal(true)}
                  className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-colors"
                  title="Send Feedback"
                >
                  <FaComment />
                </button>
              )}
              
              {/* Authentication Button */}
              {session ? (
                <button 
                  onClick={handleLogout}
                  className="p-2 bg-red-600 text-white rounded-full hover:bg-red-500 transition-colors"
                  title="Logout"
                >
                  <FaSignOutAlt />
                </button>
              ) : (
                <button 
                  onClick={openAuthModal}
                  className="p-2 bg-green-600 text-white rounded-full hover:bg-green-500 transition-colors"
                  title="Login / Sign Up"
                >
                  <FaUser />
                </button>
              )}
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
            )}
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
                {/* User Account Section */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-3 text-gray-800 dark:text-gray-200 flex items-center">
                    <FaUser className="mr-2 text-blue-500" />
                    Account
                  </h3>
                  
                  {loadingSession ? (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 text-center">
                      <div className="w-6 h-6 border-t-2 border-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-gray-600 dark:text-gray-300">Loading session...</p>
                    </div>
                  ) : session ? (
                    <div className="space-y-4">
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center mb-3">
                          <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                          <p className="text-gray-700 dark:text-gray-300 font-medium">
                            Logged in
                          </p>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 mb-2">
                          <span className="font-medium">{session.user.email}</span>
                        </p>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          Industry: <span className="font-medium">{session.user.user_metadata?.industry || "Not specified"}</span>
                        </div>
                        <button 
                          onClick={handleLogout}
                          className="w-full flex items-center justify-center py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        >
                          <FaSignOutAlt className="mr-2" />
                          Logout
                        </button>
                      </div>
                      
                      {/* Industry Form */}
                      {showIndustryForm && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                            Complete Your Profile After Refresh Page
                          </h4>
                          <form onSubmit={handleIndustryUpdate} className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Industry
                              </label>
                              <input
                                type="text"
                                value={industry}
                                onChange={(e) => setIndustry(e.target.value)}
                                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                placeholder="e.g. Technology, Marketing, Healthcare"
                                required
                              />
                            </div>
                            <button
                              type="submit"
                              className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                            >
                              Save Industry
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 text-center">
                      <div className="flex items-center justify-center mb-3">
                        <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                        <p className="text-gray-700 dark:text-gray-300 font-medium">
                          Not logged in
                        </p>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 mb-3">
                        Please log in to access all features
                      </p>
                      <button 
                        onClick={openAuthModal}
                        className="w-full flex items-center justify-center py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      >
                        <FaUser className="mr-2" />
                        Login / Sign Up
                      </button>
                    </div>
                  )}
                </div>
                
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
        
        {/* Authentication Modal */}
        {showAuthModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                    Login / Sign Up
                  </h3>
                  <button 
                    onClick={() => setShowAuthModal(false)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <FaTimes className="h-6 w-6" />
                  </button>
                </div>
                
                {emailSent ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FaCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h4 className="text-lg font-medium text-gray-800 dark:text-white mb-2">
                      Check Your Email
                    </h4>
                    <p className="text-gray-600 dark:text-gray-300">
                      We&apos;ve sent you a magic link to log in. If you&apos;re new, we&apos;ll create your account automatically.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
                      >
                        {authLoading ? "Processing..." : "Send Magic Link"}
                      </button>
                    </div>
                    
                    <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                      <p>
                        Enter your email and we&apos;ll send you a magic link to log in. 
                        New users will be created automatically.
                      </p>
                    </div>
                  </form>
                )}
              </div>
            </div>
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
                
                <form onSubmit={handleFeedbackSubmit}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Your Feedback
                    </label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={4}
                      className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="What do you think about our service?"
                      required
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
                      disabled={feedbackLoading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {feedbackLoading ? "Sending..." : "Send Feedback"}
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
