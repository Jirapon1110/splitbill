export const titleCase = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

// Full class strings so Tailwind can see them. Each person keeps the same colour everywhere.
const AVATARS = [
  "bg-lime text-lime-deep",
  "bg-[#ffc091] text-[#4a2a10]",
  "bg-[#9bdcf7] text-[#05283a]",
  "bg-[#d9d4ff] text-[#241a66]",
];

export function avatarClass(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return AVATARS[hash % AVATARS.length];
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
