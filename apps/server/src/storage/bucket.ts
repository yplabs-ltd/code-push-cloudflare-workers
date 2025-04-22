export interface BucketProvider {
  head(key: string): Promise<BucketObject | null>;
  get(key: string): Promise<BucketObjectBody | null>;
  list(options: { prefix: string }): Promise<BucketObjects>;
  delete(keys: string[] | string): Promise<void>;
  put(
    key: string,
    value: ArrayBuffer,
    options: {
      customMetadata: Record<string, string>;
    },
  ): Promise<BucketObject>;
  buildUrl(bucketName: string, path: string, accountId: string): URL;
}

export interface BucketObject {
  key: string;
  size: number;
  lastModified?: Date;
  customMetadata?: Record<string, string>;
}

export interface BucketObjectBody extends BucketObject {
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface BucketObjects {
  objects: BucketObject[];
}
