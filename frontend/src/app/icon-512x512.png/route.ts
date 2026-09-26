import fs from "fs";
import path from "path";
import { ICON_192_BASE64 } from "@/lib/icon192_base64";

export const dynamic = "force-static";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "icon-512x512.png");
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  } catch {}

  const fallback = Buffer.from(ICON_192_BASE64, "base64");
  return new Response(fallback, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
