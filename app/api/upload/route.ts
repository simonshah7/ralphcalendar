import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { isAllowedFileType, isAllowedExtension } from '@/lib/validation';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 });
    }

    // Validate file type
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!isAllowedFileType(file.type) || !isAllowedExtension(ext)) {
      return NextResponse.json(
        { error: 'File type not allowed. Accepted: images, PDFs, Office documents, CSV, and text files.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename with validated extension
    const uniqueName = `${randomUUID()}.${ext}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads');

    await mkdir(uploadDir, { recursive: true });
    const filePath = join(uploadDir, uniqueName);
    await writeFile(filePath, buffer);

    return NextResponse.json({
      id: randomUUID(),
      name: file.name,
      url: `/uploads/${uniqueName}`,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
    }, { status: 201 });
  } catch (error) {
    logger.error('Error uploading file', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
