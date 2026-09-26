import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const safeFilename = path.basename(filename);

    const pdfPath = path.join(process.cwd(), "public", "mock-pdfs", safeFilename);

    if (!fs.existsSync(pdfPath)) {
      return new Response("PDF not found", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(pdfPath);

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeFilename}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error reading PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
