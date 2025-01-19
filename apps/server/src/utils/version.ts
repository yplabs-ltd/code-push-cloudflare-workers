import { validate } from "compare-versions";

export function normalizeVersion(version: string): string {
  // Handle plain integer numbers (e.g. "1", "2")
  if (/^\d+$/.test(version)) {
    return `${version}.0.0`;
  }

  // Handle missing patch versions (e.g. "2.0" or "2.0-prerelease")
  if (/^\d+\.\d+([\+\-].*)?$/.test(version)) {
    const semverTagIndex = version.search(/[\+\-]/);
    if (semverTagIndex === -1) {
      return `${version}.0`;
    }
    return `${version.slice(0, semverTagIndex)}.0${version.slice(semverTagIndex)}`;
  }

  return version;
}

export function isValidVersion(version: string): boolean {
  // Allow plain integer numbers
  if (/^\d+$/.test(version)) {
    return true;
  }

  // Allow missing patch versions with optional tags
  if (/^\d+\.\d+([\+\-].*)?$/.test(version)) {
    return true;
  }

  // Allow full semver format
  if (/^\d+\.\d+\.\d+([\+\-].*)?$/.test(version)) {
    return true;
  }

  return validate(version);
}
