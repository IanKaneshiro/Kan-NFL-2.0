import { getAvatar } from "@/domain/avatars";

export function AvatarMark({
  avatarId,
  size = "md",
}: {
  avatarId?: string | null;
  size?: "sm" | "md";
}) {
  const a = getAvatar(avatarId);
  const dim = size === "sm" ? "h-7 w-7 text-[10px]" : "h-10 w-10 text-xs";
  return (
    <span
      title={a.label}
      className={`inline-flex ${dim} items-center justify-center rounded-full bg-gray-700 font-bold text-white`}
    >
      {a.emoji}
    </span>
  );
}
