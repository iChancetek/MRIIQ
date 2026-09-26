import { ICON_192_BASE64 } from "@/lib/icon192_base64";

export const dynamic = "force-static";

export async function GET() {
  const buffer = Buffer.from(ICON_192_BASE64, "base64");
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": buffer.length.toString(),
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
