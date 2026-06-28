import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Query,
  Headers,
  UploadedFile,
  UseInterceptors,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadService } from './upload.service';
import { FileValidationPipe } from './pipes/file-validation.pipe';

const imageMemoryStorage = memoryStorage();
const ebookMemoryStorage = memoryStorage();

@Controller('media')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('books/:bookId/cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: imageMemoryStorage,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadBookCover(
    @UploadedFile(
      new FileValidationPipe({
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        maxSizeBytes: 10 * 1024 * 1024,
      }),
    )
    file: Express.Multer.File,
    @Param('bookId') bookId: string,
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('X-User-Id header is required');
    }
    return this.uploadService.uploadBookCover(file, bookId, userId);
  }

  @Post('books/:bookId/preview')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: imageMemoryStorage,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadBookPreview(
    @UploadedFile(
      new FileValidationPipe({
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        maxSizeBytes: 10 * 1024 * 1024,
      }),
    )
    file: Express.Multer.File,
    @Param('bookId') bookId: string,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('X-User-Id header is required');
    }
    return this.uploadService.uploadBookPreview(file, bookId, page, userId);
  }

  @Post('books/:bookId/ebook')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: ebookMemoryStorage,
      limits: { fileSize: 500 * 1024 * 1024 },
    }),
  )
  async uploadEbookFile(
    @UploadedFile(
      new FileValidationPipe({
        allowedMimeTypes: ['application/pdf', 'application/epub+zip'],
        maxSizeBytes: 500 * 1024 * 1024,
      }),
    )
    file: Express.Multer.File,
    @Param('bookId') bookId: string,
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('X-User-Id header is required');
    }
    return this.uploadService.uploadEbookFile(file, bookId, userId);
  }

  @Post('users/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: imageMemoryStorage,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @UploadedFile(
      new FileValidationPipe({
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        maxSizeBytes: 5 * 1024 * 1024,
      }),
    )
    file: Express.Multer.File,
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('X-User-Id header is required');
    }
    return this.uploadService.uploadAvatar(file, userId);
  }

  @Delete(':mediaFileId')
  async deleteFile(
    @Param('mediaFileId') mediaFileId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
  ) {
    if (!userId) {
      throw new BadRequestException('X-User-Id header is required');
    }
    await this.uploadService.deleteFile(mediaFileId, userId, userRole);
    return { message: 'File deleted successfully' };
  }

  @Get('entity/:entityType/:entityId')
  async getFilesForEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.uploadService.getFilesForEntity(entityType, entityId);
  }
}
