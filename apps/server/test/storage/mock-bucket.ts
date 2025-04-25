import type {
  BucketObject,
  BucketObjectBody,
  BucketObjects,
  BucketProvider,
} from "../../src/storage/bucket";

export class MockBucketProvider implements BucketProvider {
  private readonly store = new Map<
    string,
    { data: Uint8Array; metadata: Record<string, string> }
  >();

  async head(key: string): Promise<BucketObject | null> {
    const item = this.store.get(key);
    if (!item) return null;

    return {
      key,
      size: item.data.byteLength,
      lastModified: new Date(),
      customMetadata: item.metadata,
    };
  }

  async get(key: string): Promise<BucketObjectBody | null> {
    const item = this.store.get(key);
    if (!item) return null;

    return {
      key,
      size: item.data.byteLength,
      lastModified: new Date(),
      customMetadata: item.metadata,
      arrayBuffer: async () => {
        const buffer = new ArrayBuffer(item.data.length);
        new Uint8Array(buffer).set(item.data);
        return buffer;
      },
    };
  }

  async list(options: { prefix: string }): Promise<BucketObjects> {
    const objects: BucketObject[] = [];
    for (const [key, item] of this.store) {
      if (key.startsWith(options.prefix)) {
        objects.push({
          key,
          size: item.data.byteLength,
          lastModified: new Date(),
          customMetadata: item.metadata,
        });
      }
    }
    return { objects };
  }

  async delete(keys: string[] | string): Promise<void> {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    for (const key of keyArray) {
      this.store.delete(key);
    }
  }

  async put(
    key: string,
    value: ArrayBuffer,
    options: {
      customMetadata: Record<string, string>;
    },
  ): Promise<BucketObject> {
    this.store.set(key, {
      data: new Uint8Array(value),
      metadata: options.customMetadata,
    });

    return {
      key,
      size: value.byteLength,
      lastModified: new Date(),
      customMetadata: options.customMetadata,
    };
  }

  buildUrl(bucketName: string, path: string, accountId: string): URL {
    return new URL(
      `https://${bucketName}.${accountId}.mock-storage.com/${path}`,
    );
  }
} 