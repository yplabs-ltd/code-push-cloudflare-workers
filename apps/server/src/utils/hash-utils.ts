const HASH_ALGORITHM = "SHA-256";
const CODEPUSH_METADATA = ".codepushrelease";

/**
 * Computes SHA256 hash of the provided data
 */
export async function computeHash(input: string | Uint8Array): Promise<string> {
  const data =
    typeof input === "string" ? new TextEncoder().encode(input) : input;

  const hashBuffer = await crypto.subtle.digest(HASH_ALGORITHM, data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class PackageManifest {
  private readonly _map: Map<string, string>;

  constructor(map?: Map<string, string>) {
    this._map = new Map(map || new Map());
  }

  /**
   * Returns the internal map of file paths to hashes
   */
  public toMap(): Map<string, string> {
    return new Map(this._map);
  }

  /**
   * Computes the overall package hash from all file hashes
   */
  public async computeHash(): Promise<string> {
    const entries = Array.from(this._map.entries())
      .filter(
        ([name]) =>
          name !== CODEPUSH_METADATA && !name.endsWith(`/${CODEPUSH_METADATA}`),
      )
      .map(([name, hash]) => `${name}:${hash}`)
      .sort(); // Sort entries for consistent hashing

    return computeHash(JSON.stringify(entries));
  }

  /**
   * Serializes the manifest to JSON
   */
  public serialize(): string {
    return JSON.stringify(Object.fromEntries(this._map));
  }

  /**
   * Deserializes a manifest from JSON
   */
  public static deserialize(
    serializedContents: string,
  ): PackageManifest | undefined {
    try {
      const obj = JSON.parse(serializedContents);
      const map = new Map<string, string>();

      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string") {
          map.set(key, value);
        }
      }

      return new PackageManifest(map);
    } catch {
      return undefined;
    }
  }

  /**
   * Normalizes a file path to use forward slashes
   */
  public static normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, "/");
  }

  /**
   * Checks if a file should be ignored in manifest
   */
  public static isIgnored(relativeFilePath: string): boolean {
    const MACOSX = "__MACOSX/";
    const DS_STORE = ".DS_Store";

    return (
      relativeFilePath.startsWith(MACOSX) ||
      relativeFilePath === DS_STORE ||
      relativeFilePath.endsWith(`/${DS_STORE}`)
    );
  }
}
