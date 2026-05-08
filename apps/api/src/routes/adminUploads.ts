import type { FastifyInstance } from 'fastify';
import { requireDeveloper } from '../auth/middleware.js';
import { uploadImage } from '../storage/s3.js';
import { assertAppAccess } from '../auth/appAccess.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export async function registerAdminUploadsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/admin/apps/:appId/uploads/image', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;

    const owned = await assertAppAccess(appId, dev.id);
    if (!owned) return reply.code(404).send({ error: 'app_not_found' });

    // @fastify/multipart attaches file() to the request
    const file = await (request as unknown as { file(): Promise<{ filename: string; mimetype: string; toBuffer(): Promise<Buffer> }> }).file();
    if (!file) return reply.code(400).send({ error: 'no_file' });

    const mimeType = file.mimetype.toLowerCase().replace('image/jpg', 'image/jpeg');
    if (!ALLOWED_MIME.has(mimeType)) {
      return reply.code(400).send({ error: 'invalid_mime', message: 'Only JPEG, PNG, or WebP images are accepted' });
    }

    const buffer = await file.toBuffer();
    if (buffer.length > MAX_BYTES) {
      return reply.code(400).send({ error: 'file_too_large', message: 'Maximum file size is 2 MB' });
    }

    const url = await uploadImage(buffer, mimeType as 'image/jpeg' | 'image/png' | 'image/webp');
    return reply.send({ url });
  });
}
