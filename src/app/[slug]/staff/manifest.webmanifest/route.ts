import { buildManifest, manifestResponse } from "@/lib/manifest";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return manifestResponse(await buildManifest(slug, "staff"));
}
