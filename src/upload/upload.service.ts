import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../minio/minio.service';
import { MediaFile } from '@prisma/client';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const EBOOK_MIME_TYPES = ['application/pdf', 'application/epub+zip'];

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  async uploadBookCover(
    file: Express.Multer.File,
    bookId: string,
    uploadedBy: string,
  ): Promise<{ url: string; objectKey: string }> {
    if (!IMAGE_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed: ${IMAGE_MIME_TYPES.join(', ')}`,
      );
    }

    const processedBuffer = await sharp(file.buffer)
      .resize(800, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const objectKey = this.minio.generateObjectKey('book', bookId, 'cover', 'webp');
    const bucket = 'ebooks-covers';
    const url = await this.minio.uploadBuffer(bucket, objectKey, processedBuffer, 'image/webp', {
      'x-entity-type': 'book',
      'x-entity-id': bookId,
      'x-file-type': 'cover',
    });

    await this.prisma.mediaFile.create({
      data: {
        uploadedBy,
        entityType: 'book',
        entityId: bookId,
        fileType: 'cover',
        originalName: file.originalname,
        mimeType: 'image/webp',
        sizeBytes: BigInt(processedBuffer.length),
        bucket,
        objectKey,
        publicUrl: url,
        isEncrypted: false,
      },
    });

    this.logger.log(`Uploaded book cover for bookId=${bookId}, objectKey=${objectKey}`);
    return { url, objectKey };
  }

  async uploadBookPreview(
    file: Express.Multer.File,
    bookId: string,
    pageIndex: number,
    uploadedBy: string,
  ): Promise<{ url: string; objectKey: string }> {
    if (!IMAGE_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed: ${IMAGE_MIME_TYPES.join(', ')}`,
      );
    }

    const processedBuffer = await sharp(file.buffer)
      .resize(600, 900, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const objectKey = this.minio.generateObjectKey('book', bookId, `preview-page-${pageIndex}`, 'webp');
    const bucket = 'ebooks-previews';
    const url = await this.minio.uploadBuffer(bucket, objectKey, processedBuffer, 'image/webp', {
      'x-entity-type': 'book',
      'x-entity-id': bookId,
      'x-file-type': 'preview',
      'x-page-index': String(pageIndex),
    });

    await this.prisma.mediaFile.create({
      data: {
        uploadedBy,
        entityType: 'book',
        entityId: bookId,
        fileType: 'preview',
        originalName: file.originalname,
        mimeType: 'image/webp',
        sizeBytes: BigInt(processedBuffer.length),
        bucket,
        objectKey,
        publicUrl: url,
        isEncrypted: false,
      },
    });

    this.logger.log(`Uploaded book preview for bookId=${bookId}, page=${pageIndex}, objectKey=${objectKey}`);
    return { url, objectKey };
  }

  async uploadEbookFile(
    file: Express.Multer.File,
    bookId: string,
    uploadedBy: string,
  ): Promise<{ objectKey: string; sizeBytes: number; format: string }> {
    if (!EBOOK_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed: ${EBOOK_MIME_TYPES.join(', ')}`,
      );
    }

    const format = file.mimetype === 'application/pdf' ? 'PDF' : 'EPUB';
    const extension = file.mimetype === 'application/pdf' ? 'pdf' : 'epub';

    const objectKey = `ebooks/${bookId}/file/${uuidv4()}.${extension}`;
    const bucket = 'ebooks-files';

    await this.minio.uploadBuffer(bucket, objectKey, file.buffer, file.mimetype, {
      'x-entity-type': 'book',
      'x-entity-id': bookId,
      'x-file-type': 'ebook',
      'x-encrypted': 'true',
      'x-format': format,
    });

    await this.prisma.mediaFile.create({
      data: {
        uploadedBy,
        entityType: 'book',
        entityId: bookId,
        fileType: 'ebook',
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: BigInt(file.size),
        bucket,
        objectKey,
        publicUrl: null,
        isEncrypted: true,
      },
    });

    this.logger.log(`Uploaded ebook file for bookId=${bookId}, format=${format}, objectKey=${objectKey}`);
    return { objectKey, sizeBytes: file.size, format };
  }

  async uploadAvatar(
    file: Express.Multer.File,
    userId: string,
  ): Promise<{ url: string }> {
    if (!IMAGE_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed: ${IMAGE_MIME_TYPES.join(', ')}`,
      );
    }

    const processedBuffer = await sharp(file.buffer)
      .resize(200, 200, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer();

    const objectKey = this.minio.generateObjectKey('user', userId, 'avatar', 'webp');
    const bucket = 'ebooks-avatars';
    const url = await this.minio.uploadBuffer(bucket, objectKey, processedBuffer, 'image/webp', {
      'x-entity-type': 'user',
      'x-entity-id': userId,
      'x-file-type': 'avatar',
    });

    await this.prisma.mediaFile.create({
      data: {
        uploadedBy: userId,
        entityType: 'user',
        entityId: userId,
        fileType: 'avatar',
        originalName: file.originalname,
        mimeType: 'image/webp',
        sizeBytes: BigInt(processedBuffer.length),
        bucket,
        objectKey,
        publicUrl: url,
        isEncrypted: false,
      },
    });

    this.logger.log(`Uploaded avatar for userId=${userId}, objectKey=${objectKey}`);
    return { url };
  }

  async deleteFile(mediaFileId: string, requestingUserId: string, userRole?: string): Promise<void> {
    const mediaFile = await this.prisma.mediaFile.findUnique({
      where: { id: mediaFileId },
    });

    if (!mediaFile) {
      throw new NotFoundException(`MediaFile with id ${mediaFileId} not found`);
    }

    const isOwner = mediaFile.uploadedBy === requestingUserId;
    const isAdmin = userRole === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You do not have permission to delete this file');
    }

    await this.minio.deleteObject(mediaFile.bucket, mediaFile.objectKey);
    await this.prisma.mediaFile.delete({ where: { id: mediaFileId } });

    this.logger.log(`Deleted media file id=${mediaFileId} by userId=${requestingUserId}`);
  }

  async getFilesForEntity(entityType: string, entityId: string): Promise<MediaFile[]> {
    return this.prisma.mediaFile.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
