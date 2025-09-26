// src/app/api/image/route.ts
import { promises as fs } from 'fs';
import path from 'path';

import { NextRequest, NextResponse } from 'next/server';

// Ensure Node runtime (Edge can't use 'fs')
export const runtime = 'nodejs';

// This route is dynamic (we'll set our own cache headers)
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imagePath = searchParams.get('path');          // e.g. 'cats/kitten.jpg'

  if (!imagePath) {
    return NextResponse.json({ error: 'Image path and folder path are required.' }, { status: 400 });
  }

  // SECURITY: ensure the resolved path stays under folderPath
  // const absFolder = path.resolve(folderPath);
  const absImage = imagePath
  // if (!absImage.startsWith(absFolder + path.sep)) {
  //   return NextResponse.json({ error: 'Invalid path.' }, { status: 400 });
  // }

  try {
    const stats = await fs.stat(absImage);
    const etag = `"${stats.size}-${stats.mtimeMs}"`;
    const lastModified = stats.mtime.toUTCString();

    // If client sends validators, respond 304 when appropriate
    const ifNoneMatch = req.headers.get('if-none-match');
    const ifModifiedSince = req.headers.get('if-modified-since');

    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Last-Modified': lastModified,
          // match your cache policy below
          'Cache-Control': 'public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400',
        },
      });
    }
    if (ifModifiedSince && new Date(ifModifiedSince) >= stats.mtime) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Last-Modified': lastModified,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }


    const fileBuffer = await fs.readFile(absImage)

    const ext = path.extname(absImage).slice(1).toLowerCase();
    const mimeType =
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
        ext === 'png' ? 'image/png' :
          ext === 'webp' ? 'image/webp' :
            ext === 'gif' ? 'image/gif' :
              'application/octet-stream';

    // Caching strategy:
    // - If your file names are content-hashed (never change at same URL), prefer:
    //   'public, max-age=31536000, immutable'
    // - If file content can change at same URL, use CDN caching with SWR:
    //   browser: no cache (max-age=0), CDN: 1 year (s-maxage), allow stale while revalidating
    const cacheControl = 'public, max-age=31536000, immutable';

    return new NextResponse(fileBuffer as BodyInit, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileBuffer.length.toString(),
        ETag: etag,
        'Last-Modified': lastModified,
        'Cache-Control': cacheControl,
      },
    });
  } catch (error) {
    console.error(`Error serving image ${imagePath}:`, error);
    return NextResponse.json({ error: 'Image not found or inaccessible.' }, { status: 404 });
  }
}