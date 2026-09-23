/**
 * Generated media (Higgsfield). Hosted on the Higgsfield CDN; to self-host, download the files into
 * public/media/ and set NEXT_PUBLIC_HERO_CLIPS (comma-separated) or edit the URLs below.
 */
const CDN = "https://d8j0ntlcm91z4.cloudfront.net/user_3Ji2ekPsox1wLHuWkDUqiQBwxF6";

const DEFAULT_CLIPS = [
  `${CDN}/hf_20260923_040208_08c3a5da-c6de-47be-af57-f3af583fbad9.mp4`, // wafer loading in amber cleanroom
  `${CDN}/hf_20260923_040150_4f94aa43-ab41-49f8-83f9-4aa6d6749141.mp4`, // oscilloscope troubleshooting
  `${CDN}/hf_20260923_041415_c351cc95-e27c-4eed-b9e9-389fb06dc35b.mp4`, // team walking the fab + vacuum line
];

export const HERO_CLIPS: string[] = (process.env.NEXT_PUBLIC_HERO_CLIPS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean).length
  ? (process.env.NEXT_PUBLIC_HERO_CLIPS as string).split(",").map((s) => s.trim()).filter(Boolean)
  : DEFAULT_CLIPS;

export const IMAGES = {
  wafer: `${CDN}/hf_20260923_041811_ca480f14-200d-49ac-8bad-44e16ec7d763_min.webp`,
  pneumaticsLab: `${CDN}/hf_20260923_041811_4c986299-1e2c-421f-ac06-b2e9a68b1426_min.webp`,
  oscilloscope: `${CDN}/hf_20260923_041811_2397f7ea-15b8-485d-931b-85b8c01e6903_min.webp`,
  fabExterior: `${CDN}/hf_20260923_041811_ab36a128-bf7c-4feb-b014-a005e67e0b47_min.webp`,
} as const;
