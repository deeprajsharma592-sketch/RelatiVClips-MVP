// Dev-only mock. Frontend uses NEXT_PUBLIC_API_URL (backend:9000) directly.
// This file is disconnected from the real frontend — kept for reference/testing.
import { NextResponse } from "next/server";

const tasks = new Map<
  string,
  {
    status: string;
    progress: number;
    clips: unknown[];
    error?: string;
  }
>();

function generateMockClips() {
  const titles = [
    "Quantum Hook: Key Insight Unlocked",
    "Momentum Shift: Energy Spike Detected",
    "Signal Peak: Highest Engagement Zone",
    "Focal Point: Core Message Extracted",
    "Waveform Crest: Emotional High",
  ];
  return Array.from({ length: 3 }, (_, i) => ({
    id: `clip_${Date.now()}_${i + 1}`,
    title: titles[i % titles.length],
    startTime: 12 + i * 28,
    endTime: 32 + i * 28,
    viralityIndex: Math.round((85 + Math.random() * 14) * 10) / 10,
    videoPath: `/videos/sample_clip_${i + 1}.mp4`,
    caption: "AI-extracted high-signal segment from source material.",
  }));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { videoUrl, fileName } = body;

    if (!videoUrl && !fileName) {
      return NextResponse.json(
        { error: "No video source provided. Provide a URL or file." },
        { status: 400 }
      );
    }

    if (videoUrl) {
      const urlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|twitch\.tv)\/.+/i;
      if (!urlPattern.test(videoUrl)) {
        return NextResponse.json(
          {
            error:
              "Invalid URL. Supported platforms: YouTube, Twitch, or direct video links.",
          },
          { status: 400 }
        );
      }
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    tasks.set(taskId, {
      status: "PENDING",
      progress: 0,
      clips: [],
    });

    const processSequence = async () => {
      await new Promise((r) => setTimeout(r, 2000));
      tasks.set(taskId, {
        status: "ANALYZING_AUDIO",
        progress: 25,
        clips: [],
      });

      await new Promise((r) => setTimeout(r, 3000));
      tasks.set(taskId, {
        status: "PROCESSING_FRAMES",
        progress: 55,
        clips: [],
      });

      await new Promise((r) => setTimeout(r, 3000));
      const clips = generateMockClips();
      tasks.set(taskId, {
        status: "COMPLETED",
        progress: 100,
        clips,
      });
    };

    processSequence().catch((err) => {
      tasks.set(taskId, {
        status: "ERROR",
        progress: 0,
        clips: [],
        error: err instanceof Error ? err.message : "Processing failed",
      });
    });

    return NextResponse.json({
      taskId,
      status: "PENDING",
      progress: 0,
      clips: [],
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");

  if (!taskId || !tasks.has(taskId)) {
    return NextResponse.json(
      { error: "Task not found. Provide a valid taskId." },
      { status: 404 }
    );
  }

  const task = tasks.get(taskId)!;
  return NextResponse.json({
    taskId,
    status: task.status,
    progress: task.progress,
    clips: task.clips,
    error: task.error,
  });
}
