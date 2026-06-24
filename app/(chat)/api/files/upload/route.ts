import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { canAccessProFeatures } from "@/lib/admin";
import { getUserById } from "@/lib/db/queries";

const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: "File size should be less than 5MB",
    })
    .refine((file) => ["image/jpeg", "image/png"].includes(file.type), {
      message: "File type should be JPEG or PNG",
    }),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Photo analysis is a Chad Pro feature. Backstop the UI gate here so a
  // non-Pro member can't reach Blob storage by calling the route directly.
  const user = await getUserById(session.user.id);

  if (!(user && canAccessProFeatures(user))) {
    return NextResponse.json(
      { error: "Photos are a Chad Pro feature. Upgrade to send Chad a photo." },
      { status: 403 }
    );
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const filename = (formData.get("file") as File).name;
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileBuffer = await file.arrayBuffer();

    // Blob storage needs a write token. If it's missing the platform throws a
    // cryptic error — catch that case explicitly so the failure is obvious in
    // the logs (it's a deploy/config gap, not a user error).
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error(
        "[files/upload] BLOB_READ_WRITE_TOKEN is not set — photo storage is unconfigured."
      );
      return NextResponse.json(
        {
          error:
            "Photo storage isn't set up yet. We've been notified — try again shortly.",
        },
        { status: 503 }
      );
    }

    try {
      const data = await put(`${safeName}`, fileBuffer, {
        access: "public",
        // Two members (or one member twice) can upload files with the same
        // name — keep every blob at a unique path so an upload never collides
        // with an existing one. (Default, but pinned so a dep bump can't change
        // it under us.)
        addRandomSuffix: true,
      });

      return NextResponse.json(data);
    } catch (error) {
      // Surface the real reason in the server logs; keep the client message
      // generic but actionable.
      console.error("[files/upload] Blob put() failed:", error);
      return NextResponse.json(
        { error: "Couldn't save your photo. Please try again." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[files/upload] Failed to process request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
