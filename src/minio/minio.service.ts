import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';

export const PUBLIC_BUCKETS = ['ebooks-covers', 'ebooks-previews', 'ebooks-avatars'];
export const PRIVATE_BUCKETS = ['ebooks-files'];

const PUBLIC_POLICY = (bucketName: string) =>
  JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucketName}/*`],
      },
    ],
  });

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: Minio.Client;
  private readonly endpoint: string;
  private readonly port: number;
  private readonly useSSL: boolean;

  constructor(private readonly configService: ConfigService) {
    this.endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost');
    this.port = parseInt(this.configService.get<string>('MINIO_PORT', '9000'), 10);
    this.useSSL = this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';

    this.client = new Minio.Client({
      endPoint: this.endpoint,
      port: this.port,
      useSSL: this.useSSL,
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    });
  }

  async onModuleInit() {
    await this.ensureBucketsExist();
  }

  async ensureBucketsExist(): Promise<void> {
    const allBuckets = [...PUBLIC_BUCKETS, ...PRIVATE_BUCKETS];

    for (const bucket of allBuckets) {
      const exists = await this.client.bucketExists(bucket);
      if (!exists) {
        await this.client.makeBucket(bucket, 'us-east-1');
        this.logger.log(`Created bucket: ${bucket}`);
      } else {
        this.logger.log(`Bucket already exists: ${bucket}`);
      }

      if (PUBLIC_BUCKETS.includes(bucket)) {
        await this.client.setBucketPolicy(bucket, PUBLIC_POLICY(bucket));
        this.logger.log(`Set public policy on bucket: ${bucket}`);
      }
    }
  }

  async uploadBuffer(
    bucket: string,
    objectKey: string,
    buffer: Buffer,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    const metaData: Record<string, string> = {
      'Content-Type': contentType,
      ...(metadata || {}),
    };

    await this.client.putObject(bucket, objectKey, buffer, buffer.length, metaData);

    if (PUBLIC_BUCKETS.includes(bucket)) {
      return this.buildPublicUrl(bucket, objectKey);
    }
    return objectKey;
  }

  async uploadStream(
    bucket: string,
    objectKey: string,
    stream: NodeJS.ReadableStream,
    size: number,
    contentType: string,
  ): Promise<string> {
    const metaData = { 'Content-Type': contentType };
    await this.client.putObject(bucket, objectKey, stream as Readable, size, metaData);

    if (PUBLIC_BUCKETS.includes(bucket)) {
      return this.buildPublicUrl(bucket, objectKey);
    }
    return objectKey;
  }

  async deleteObject(bucket: string, objectKey: string): Promise<void> {
    await this.client.removeObject(bucket, objectKey);
    this.logger.log(`Deleted object ${objectKey} from bucket ${bucket}`);
  }

  async getObject(bucket: string, objectKey: string): Promise<Buffer> {
    const stream = await this.client.getObject(bucket, objectKey);
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async getPresignedUrl(bucket: string, objectKey: string, expirySeconds: number): Promise<string> {
    return this.client.presignedGetObject(bucket, objectKey, expirySeconds);
  }

  generateObjectKey(entityType: string, entityId: string, fileType: string, extension: string): string {
    return `${entityType}/${entityId}/${fileType}/${uuidv4()}.${extension}`;
  }

  private buildPublicUrl(bucket: string, objectKey: string): string {
    const protocol = this.useSSL ? 'https' : 'http';
    const portStr = (this.useSSL && this.port === 443) || (!this.useSSL && this.port === 80)
      ? ''
      : `:${this.port}`;
    return `${protocol}://${this.endpoint}${portStr}/${bucket}/${objectKey}`;
  }
}
