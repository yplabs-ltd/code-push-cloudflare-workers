
export interface BucketProvider {
  head(key: string): Promise<BucketObject | null>;
  get(key: string): Promise<BucketObjectBody | null>;
  list(options: { prefix: string }): Promise<BucketObjects>;
  delete(key: string): Promise<void>;
  put(
    key: string,
    value: ArrayBuffer,
    options: {
      customMetadata: Record<string, string> | undefined;
    },
  ): Promise<BucketObject>;
  buildUrl(bucketName: string, path: string, accountId: string): URL;
}

interface BucketObject {
  key: string;
}

interface BucketObjectBody {
  customMetadata?: Record<string, string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface BucketObjects {
  objects: BucketObject[];
}

export class R2BucketProvider implements BucketProvider {
  constructor(private readonly bucket: R2Bucket) {}

  async get(key: string) {
    return this.bucket.get(key);
  }

  async list(options: { prefix: string }): Promise<BucketObjects> {
    return this.bucket.list(options);
  }

  async delete(keys: string[] | string): Promise<void> {
    return this.bucket.delete(keys);
  }

  async put(
    key: string,
    value: ArrayBuffer,
    options: {
      customMetadata: Record<string, string>;
    },
  ): Promise<BucketObject> {
    return await this.bucket.put(key, value, options);
  }

  async head(key: string): Promise<BucketObject | null> {
    return await this.bucket.head(key);
  }

  buildUrl(bucketName: string, path: string, accountId: string): URL {
    return new URL(
      `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${path}`,
    );
  }
}