/** 128×128 void-and-cluster blue-noise thresholds (Ulichney). */
export const BLUE_NOISE_SIZE = 128;
export const BLUE_NOISE_URL = "/board/blue-noise-128.bin";

let loaded: Uint8Array | null = null;

export function setBlueNoise(bytes: Uint8Array): void {
  loaded = bytes;
}

export function getBlueNoise(): Uint8Array | null {
  return loaded;
}

export async function loadBlueNoise(): Promise<Uint8Array> {
  if (loaded) return loaded;
  const response = await fetch(BLUE_NOISE_URL);
  if (!response.ok) {
    throw new Error(`Failed to load blue-noise tile: ${response.status}`);
  }
  loaded = new Uint8Array(await response.arrayBuffer());
  return loaded;
}
