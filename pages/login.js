import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion } from "framer-motion";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [view, setView] = useState("login"); // "login", "verify", "reset"
  
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (view === "login") {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        router.push("/chat");
      }
    } else if (view === "verify") {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("OTP verified! You can now enter your new password.");
        setView("reset");
      } else {
        setError(data.message);
      }
    } else if (view === "reset") {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message);
        setView("login");
        setPassword("");
        setOtp("");
        setNewPassword("");
      } else {
        setError(data.message);
      }
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setSuccess("");
    if (!email) {
      setError("Please enter your email address first to reset your password.");
      return;
    }
    
    // Request OTP
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    
    const data = await res.json();
    if (res.ok) {
      setSuccess("An OTP has been sent to your email!");
      setView("verify");
    } else {
      setError(data.message);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      className="min-h-screen relative bg-white font-sans text-gray-800 overflow-hidden flex items-center"
    >
      
      {/* Global Background Abstract Shapes (Breaks the split-screen feel) */}
      <motion.div 
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
      >
        {/* Top Left Gradient Circle */}
        <div className="absolute top-[-10%] left-[40%] w-[30rem] h-[30rem] bg-gradient-to-br from-indigo-100 to-purple-200 rounded-full opacity-70 blur-[2px]"></div>

        {/* Top Right Orange Arch */}
        <div className="absolute top-0 right-32 w-64 h-32 bg-[#FFA88C] rounded-b-full opacity-90"></div>
        
        {/* Far Top Right Pinkish Circle */}
        <div className="absolute top-10 -right-20 w-64 h-64 bg-[#F0B3E1] rounded-full opacity-90"></div>

        {/* Center Red Pill / Soft Triangle */}
        <div className="absolute bottom-[10%] left-[45%] w-32 h-48 bg-gradient-to-br from-rose-400 to-red-500 rounded-[50px] rounded-tl-[100px] -rotate-12 opacity-90 blur-[1px]"></div>
        
        {/* Soft Pink Glow behind the red pill */}
        <div className="absolute bottom-[10%] left-[45%] w-48 h-48 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>

        {/* Bottom Right Blue Semi-Circle */}
        <div className="absolute bottom-[-5%] right-[20%] w-48 h-48 bg-[#8CD3E5] rounded-bl-full rotate-45 opacity-90"></div>

        {/* Far Bottom Right Purple Triangle */}
        <div className="absolute bottom-[20%] right-10 w-48 h-48 bg-[#BCB1F1] rounded-[40px] rotate-[15deg] opacity-90"></div>
      </motion.div>

      {/* Main Content Layout */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-8 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        
        {/* Left Side: Form */}
        <motion.div 
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="w-full max-w-md mx-auto lg:ml-0 bg-white/80 backdrop-blur-md p-8 rounded-3xl lg:bg-transparent lg:backdrop-blur-none lg:p-0"
        >
          
          {/* Logo Area */}
          <div className="mb-12 flex flex-col items-center lg:items-start">
            <div className="flex items-center justify-center mb-8">
              <div className="relative">
                <span className="text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 drop-shadow-sm">
                  Zenith
                </span>
                <div className="w-3 h-3 bg-pink-500 rounded-full absolute bottom-2 -right-4 shadow-md"></div>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mx-auto lg:mx-0">
              {view === "login" ? "Login" : view === "verify" ? "Enter OTP" : "Reset Password"}
            </h2>
          </div>

          {error && (
            <div className="bg-red-50 text-red-500 px-4 py-3 rounded-md mb-6 text-sm text-center">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 text-green-600 px-4 py-3 rounded-md mb-6 text-sm text-center">
              {success}
            </div>
          )}

          {view === "login" && (
            <button type="button" onClick={() => signIn('google', { callbackUrl: '/chat' })} className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl shadow-sm hover:bg-gray-50 hover:shadow transition-all mb-8">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>
          )}

          {view === "login" && (
            <div className="flex items-center justify-between mb-8">
              <div className="w-full h-px bg-gray-200"></div>
              <span className="text-xs text-gray-400 px-4 whitespace-nowrap font-medium">Or sign in with email</span>
              <div className="w-full h-px bg-gray-200"></div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {view === "login" && (
              <>
                <div>
                  <input
                    type="email"
                    className="w-full px-5 py-4 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm placeholder-gray-400 shadow-sm"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="relative">
                  <input
                    type="password"
                    className="w-full px-5 py-4 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm placeholder-gray-400 shadow-sm"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  {/* Fake eye icon */}
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 bg-gray-50 cursor-pointer" />
                    <span className="ml-2 text-xs text-gray-600 font-medium">Keep me logged in</span>
                  </label>
                  <button type="button" onClick={handleForgotPassword} className="text-xs font-semibold text-blue-500 hover:text-blue-600 bg-transparent border-none outline-none">Forgot password?</button>
                </div>
              </>
            )}

            {view === "verify" && (
              <>
                <p className="text-sm text-gray-600 mb-2">We sent a 6-digit code to <strong>{email}</strong>.</p>
                <div>
                  <input
                    type="text"
                    className="w-full px-5 py-4 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm placeholder-gray-400 shadow-sm text-center tracking-[0.5em] font-mono text-xl"
                    placeholder="------"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                    maxLength={6}
                  />
                </div>
                <button type="button" onClick={() => setView("login")} className="text-xs font-semibold text-blue-500 hover:text-blue-600 bg-transparent border-none outline-none pt-2">Back to Login</button>
              </>
            )}

            {view === "reset" && (
              <>
                <p className="text-sm text-gray-600 mb-2">Create a new, secure password.</p>
                <div>
                  <input
                    type="password"
                    className="w-full px-5 py-4 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm placeholder-gray-400 shadow-sm"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <button type="button" onClick={() => setView("login")} className="text-xs font-semibold text-blue-500 hover:text-blue-600 bg-transparent border-none outline-none pt-2">Cancel</button>
              </>
            )}

            <button
              type="submit"
              className="w-full bg-[#7C5FF6] text-white font-medium py-4 px-4 rounded-xl shadow-lg shadow-indigo-200/50 hover:bg-[#684be6] hover:-translate-y-0.5 transition-all mt-4 text-sm"
            >
              {view === "login" ? "Login" : view === "verify" ? "Verify OTP" : "Update Password"}
            </button>
          </form>

          <p className="mt-10 text-center text-sm text-gray-500 font-medium">
            Don't have an account?{" "}
            <Link href="/signup" className="text-blue-500 font-semibold hover:text-blue-600 transition-colors">
              Sign up
            </Link>
          </p>
        </motion.div>

        {/* Right Side: Text Area (Shapes are now global) */}
        <motion.div 
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
          className="hidden lg:flex flex-col justify-center items-center h-full pl-10 relative"
        >
          
          <div className="relative z-20 text-center space-y-4">
            <h1 className="text-[3.5rem] leading-[1.1] font-bold text-gray-900 tracking-tight">
              Changing the way<br />the world writes
            </h1>
            <p className="text-gray-500 text-lg">Experience the next generation of AI workspaces.</p>
            
            {/* Subtle dot grid behind text */}
            <div className="absolute -top-12 -right-12 w-40 h-40 opacity-20 pointer-events-none" style={{ backgroundImage: "radial-gradient(#000 1.5px, transparent 1.5px)", backgroundSize: "16px 16px" }}></div>
          </div>

        </motion.div>
      </div>
    </motion.div>
  );
}
