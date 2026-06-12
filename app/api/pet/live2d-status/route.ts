import { NextResponse } from "next/server";
import live2dTargetModule from "@/lib/pet/live2d-target.js";

const { getLive2DStatus } = live2dTargetModule as {
  getLive2DStatus: (projectRoot: string) => {
    available: boolean;
    source: "custom" | "sample_only" | "missing";
    modelPath: string | null;
    message: string;
  };
};

export async function GET() {
  const status = getLive2DStatus(process.cwd());
  return NextResponse.json({
    available: status.available,
    source: status.source,
    message: status.message
  });
}
