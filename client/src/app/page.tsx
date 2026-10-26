import { connection } from "next/server";
import { Suspense } from "react";

import { SetupError } from "../lib/errors";
import { ensureIndexReady } from "../lib/index/load";
import { Chat } from "./chat";

export default function HomePage() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Handbook Q&amp;A</h1>
        <p>
          Ask a question about the company handbook. Answers come only from the handbook, with
          the passages they&apos;re based on so you can check them.
        </p>
      </header>
      <Suspense fallback={null}>
        <SetupWarning />
      </Suspense>
      <Chat />
    </div>
  );
}

async function SetupWarning() {
  // Check the database on each request, not once at build time.
  await connection();

  try {
    await ensureIndexReady();
    return null;
  } catch (error) {
    if (!(error instanceof SetupError)) console.error("Index check failed:", error);
    const message =
      error instanceof SetupError
        ? error.message
        : "Couldn't check the search index, so questions may fail.";
    return (
      <p className="banner" role="alert">
        {message}
      </p>
    );
  }
}
