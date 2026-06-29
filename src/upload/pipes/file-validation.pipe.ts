import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';

export interface FileValidationOptions {
  allowedMimeTypes: string[];
  maxSizeBytes?: number;
  required?: boolean;
}

// Verified magic bytes to prevent MIME-type spoofing
const MAGIC_VALIDATORS: Array<{
  mimeTypes: string[];
  check: (buf: Buffer) => boolean;
  label: string;
}> = [
  {
    mimeTypes: ['application/pdf'],
    check: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
    label: 'PDF',
  },
  {
    mimeTypes: ['image/jpeg'],
    check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    label: 'JPEG',
  },
  {
    mimeTypes: ['image/png'],
    check: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
    label: 'PNG',
  },
  {
    mimeTypes: ['image/webp'],
    check: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
    label: 'WebP',
  },
  {
    // EPUB is a ZIP archive
    mimeTypes: ['application/epub+zip'],
    check: (b) => b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07),
    label: 'EPUB (ZIP)',
  },
];

@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(private readonly options: FileValidationOptions) {}

  transform(file: Express.Multer.File, _metadata: ArgumentMetadata): Express.Multer.File {
    if (!file) {
      if (this.options.required !== false) {
        throw new BadRequestException('File is required');
      }
      return file;
    }

    if (!this.options.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed types: ${this.options.allowedMimeTypes.join(', ')}`,
      );
    }

    if (this.options.maxSizeBytes && file.size > this.options.maxSizeBytes) {
      const maxMB = (this.options.maxSizeBytes / (1024 * 1024)).toFixed(0);
      throw new BadRequestException(`File too large. Maximum size is ${maxMB}MB`);
    }

    // Verify magic bytes to detect files with forged MIME types
    const buf = file.buffer;
    if (buf && buf.length >= 12) {
      const validator = MAGIC_VALIDATORS.find((v) => v.mimeTypes.includes(file.mimetype));
      if (validator && !validator.check(buf)) {
        throw new BadRequestException(
          `File content does not match declared type ${file.mimetype}. Expected a valid ${validator.label} file.`,
        );
      }
    }

    return file;
  }
}
