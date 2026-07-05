# Zenith AI Chatbot 🚀

A modern, full-stack AI chatbot application built with **Next.js**. Zenith AI acts as a smart, multimodal assistant capable of maintaining persistent conversation history, analyzing uploaded images, and answering questions based on uploaded documents (RAG).

## ✨ Features
- **Secure Authentication**: User login via Google OAuth and Credentials using NextAuth.js.
- **Persistent Conversations**: Chat history is automatically saved and retrieved using Prisma and PostgreSQL.
- **Smart AI Integration**: Powered by Google's Gemini API (Gemini 1.5 Flash).
- **Multimodal Support**: Upload images directly into the chat for the AI to analyze and discuss.
- **Document Ingestion (RAG)**: Upload PDFs or text files to ingest them into a vector database (pgvector). You can then toggle "Use Docs" to force the AI to answer questions strictly based on your uploaded context.
- **Sleek UI**: Beautiful, animated interface built with Tailwind CSS and Framer Motion.

## 🛠️ Tech Stack
- **Frontend**: Next.js, React, Tailwind CSS, Framer Motion
- **Backend**: Next.js API Routes, NextAuth.js
- **Database**: PostgreSQL (with pgvector, hosted on Supabase/Neon/etc.), Prisma ORM
- **AI/LLM**: Google Generative AI (Gemini SDK)

## 🚀 Getting Started Locally

### Prerequisites
Make sure you have Node.js installed and a PostgreSQL database setup.

### 1. Clone the repository
```bash
git clone https://github.com/YourUsername/zenith-ai-chat.git
cd zenith-ai-chat
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root of your project and add the following keys:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/zenith?schema=public"

# NextAuth
NEXTAUTH_SECRET="your-super-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (Optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Gemini AI
GEMINI_API_KEY="your-gemini-api-key"
```

### 4. Setup Database
Push the Prisma schema to your PostgreSQL database:
```bash
npx prisma db push
```

### 5. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## ☁️ Deploying to Vercel

This project is optimized for deployment on Vercel. Since it uses a PostgreSQL database and NextAuth, there are a few important steps to follow during deployment.

### Step 1: Push to GitHub
Make sure your latest code is pushed to your GitHub repository.

### Step 2: Import Project in Vercel
1. Log in to [Vercel](https://vercel.com/) and click **Add New** > **Project**.
2. Select your GitHub repository and click **Import**.

### Step 3: Configure Environment Variables in Vercel
Before clicking "Deploy", open the **Environment Variables** section and add all the variables from your local `.env` file:
- `DATABASE_URL`: Ensure this points to a cloud-hosted PostgreSQL database (like Supabase, Neon, or Vercel Postgres).
- `NEXTAUTH_SECRET`: Generate a random string (e.g., using `openssl rand -base64 32`) and paste it here.
- `NEXTAUTH_URL`: Set this to your production Vercel URL (e.g., `https://zenith-ai-chat.vercel.app`). *You may need to deploy once to get the URL, then add it and redeploy.*
- `GEMINI_API_KEY`: Your Google Gemini API key.
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: If using Google Auth, make sure to add your Vercel URL to your authorized redirect URIs in the Google Cloud Console (e.g., `https://your-app.vercel.app/api/auth/callback/google`).

### Step 4: Build Command Setup (Prisma)
Vercel needs to generate the Prisma client before building the Next.js app. The `package.json` script has already been updated to handle this automatically:
```json
"scripts": {
  "build": "prisma generate && next build"
}
```

### Step 5: Deploy
Click **Deploy**. Vercel will build your project and give you a live URL!
