// app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Agent, setGlobalDispatcher } from "undici";

setGlobalDispatcher(new Agent({ headersTimeout: 900_000, bodyTimeout: 900_000 })); // 15 min

export async function POST(req: NextRequest) {
  const incoming = await req.formData();
  const file = incoming.get("file");
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const forward = new FormData();
  forward.append("file", file as Blob);

  const res = await fetch(process.env.INFERENCE_URL || "http://localhost:8000/predict", {
    method: "POST",
    body: forward,
  });

  if (!res.ok) return NextResponse.json({ error: "Inference failed" }, { status: 500 });
  return NextResponse.json(await res.json());
}