import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';

export interface FileValidationOptions {
  allowedMimeTypes: string[];
  maxSizeBytes?: number;
  required?: boolean;
}

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

    return file;
  }
}
