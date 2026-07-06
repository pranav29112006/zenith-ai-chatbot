import Head from "next/head";
import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/router";
import { SessionProvider } from "next-auth/react";
import "../styles/globals.css";

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  const router = useRouter();

  return (
    <SessionProvider session={session}>
      <Head>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <title>Zenith AI Chatbot</title>
      </Head>
      <AnimatePresence mode="wait">
        <Component key={router.pathname} {...pageProps} />
      </AnimatePresence>
    </SessionProvider>
  );
}
