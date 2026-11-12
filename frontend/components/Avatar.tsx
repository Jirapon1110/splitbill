import { avatarClass } from "@/lib/ui";

export default function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-bold uppercase ${avatarClass(
        name,
      )} ${size === "md" ? "h-10 w-10 text-sm" : "h-6 w-6 text-xs"}`}
    >
      {name.slice(0, 1)}
    </span>
  );
}
