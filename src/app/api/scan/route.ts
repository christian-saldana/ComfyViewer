import { NextRequest, NextResponse } from 'next/server';

import scanDirectory from './extractors';

export async function POST(req: NextRequest) {
  try {
    const { path: folderPath, existingPaths: existingPathsArray } = await req.json();

    if (!folderPath) {
      return NextResponse.json({ error: 'Folder path is required.' }, { status: 400 });
    }

    // If existingPathsArray is provided, we're doing a refresh (scan for new).
    // Otherwise, it's a full scan.
    const existingPaths = existingPathsArray ? new Set<string>(existingPathsArray) : undefined;

    const allMetadata = await scanDirectory(folderPath, folderPath, existingPaths);

    return NextResponse.json(allMetadata);

  } catch (error: any) {
    console.error("Error in /api/scan route:", error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}