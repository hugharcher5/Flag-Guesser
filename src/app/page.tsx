"use client";

import { useState } from "react";
import NavBar from "@/components/NavBar";
import type { AppMode } from "@/components/NavBar";
import PracticeMode from "@/components/PracticeMode";
import SpeedQuizMode from "@/components/SpeedQuizMode";

export default function Page() {
  const [mode, setMode] = useState<AppMode>("practice");

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <NavBar mode={mode} onModeChange={setMode} />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        {mode === "practice" ? <PracticeMode /> : <SpeedQuizMode />}
      </main>
    </div>
  );
}
