import type { NextApiRequest, NextApiResponse } from 'next';
import { execFile } from 'child_process';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

type UploadResponse = {
  message?: string;
  fileName?: string;
  output?: string;
  error?: string;
};

type UploadedFile = {
  data: Buffer;
  fileName: string;
  contentType: string;
};

const readRequestBody = async (req: NextApiRequest) => {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
};

const getHeaderValue = (headers: string, name: string) => {
  const match = headers.match(new RegExp(`${name}:\\s*([^\\r\\n]+)`, 'i'));
  return match?.[1]?.trim() ?? '';
};

const getDispositionValue = (header: string, name: string) => {
  const match = header.match(new RegExp(`${name}="([^"]+)"`, 'i'));
  return match?.[1] ?? '';
};

const parseMultipartPdf = (body: Buffer, contentType: string): UploadedFile => {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];

  if (!boundary) {
    throw new Error('Missing multipart boundary');
  }

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  let boundaryIndex = body.indexOf(boundaryBuffer);

  while (boundaryIndex !== -1) {
    let partStart = boundaryIndex + boundaryBuffer.length;

    if (body[partStart] === 45 && body[partStart + 1] === 45) {
      break;
    }

    if (body[partStart] === 13 && body[partStart + 1] === 10) {
      partStart += 2;
    }

    const nextBoundaryIndex = body.indexOf(boundaryBuffer, partStart);
    if (nextBoundaryIndex === -1) {
      break;
    }

    let part = body.slice(partStart, nextBoundaryIndex);
    if (
      part.length >= 2 &&
      part[part.length - 2] === 13 &&
      part[part.length - 1] === 10
    ) {
      part = part.slice(0, -2);
    }

    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd !== -1) {
      const rawHeaders = part.slice(0, headerEnd).toString('latin1');
      const disposition = getHeaderValue(rawHeaders, 'content-disposition');
      const fieldName = getDispositionValue(disposition, 'name');
      const fileName = getDispositionValue(disposition, 'filename');

      if (fieldName === 'file' && fileName) {
        return {
          data: part.slice(headerEnd + 4),
          fileName,
          contentType: getHeaderValue(rawHeaders, 'content-type'),
        };
      }
    }

    boundaryIndex = nextBoundaryIndex;
  }

  throw new Error('No PDF file found in upload');
};

const safePdfFileName = (fileName: string) => {
  const normalized = fileName.replace(/\\/g, '/').split('/').pop() ?? '';
  const sanitized = normalized.replace(/[^a-zA-Z0-9._-]/g, '_');

  if (!sanitized || extname(sanitized).toLowerCase() !== '.pdf') {
    throw new Error('Only PDF files are supported');
  }

  return `${Date.now()}-${sanitized}`;
};

const runCommand = (command: string, args: string[]) =>
  new Promise<string>((resolve, reject) => {
    execFile(
      command,
      args,
      {
        cwd: process.cwd(),
        env: process.env,
        maxBuffer: 1024 * 1024 * 20,
        shell: process.platform === 'win32',
      },
      (error, stdout, stderr) => {
        const output = [stdout, stderr].filter(Boolean).join('\n');

        if (error) {
          reject(new Error(output || error.message));
          return;
        }

        resolve(output);
      },
    );
  });

const runIngestion = async () => {
  const yarnCommand = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  try {
    return await runCommand(yarnCommand, ['run', 'ingest']);
  } catch (error: any) {
    const message = String(error?.message ?? '');
    const yarnMissing =
      message.includes('ENOENT') ||
      message.includes('not recognized') ||
      message.includes('cannot find');

    if (!yarnMissing) {
      throw error;
    }

    return runCommand(npmCommand, ['run', 'ingest']);
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse>,
) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const contentTypeHeader = req.headers['content-type'] ?? '';
    const contentType = Array.isArray(contentTypeHeader)
      ? contentTypeHeader[0] ?? ''
      : contentTypeHeader;
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
      res.status(400).json({ error: 'Upload must use multipart/form-data' });
      return;
    }

    const body = await readRequestBody(req);
    const file = parseMultipartPdf(body, contentType);
    const savedFileName = safePdfFileName(file.fileName);

    if (
      file.contentType &&
      !file.contentType.toLowerCase().startsWith('application/pdf') &&
      !file.contentType.toLowerCase().startsWith('application/octet-stream')
    ) {
      res.status(400).json({ error: 'Only PDF files are supported' });
      return;
    }

    const docsDir = join(process.cwd(), 'docs');
    await mkdir(docsDir, { recursive: true });
    await writeFile(join(docsDir, savedFileName), file.data);

    const output = await runIngestion();

    res.status(200).json({
      message: 'PDF uploaded and ingested successfully',
      fileName: savedFileName,
      output,
    });
  } catch (error: any) {
    console.error('upload error', error);
    res.status(500).json({
      error: error.message || 'Failed to upload and ingest PDF',
    });
  }
}
