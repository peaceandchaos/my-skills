import { mockDecide, type JevState } from "@/lib/jev/mock";

export async function POST(req: Request) {
  const started = Date.now();
  const state = (await req.json()) as JevState;
  const decision = mockDecide(state, started);
  return Response.json({ ...decision, latencyMs: Date.now() - started });
}
