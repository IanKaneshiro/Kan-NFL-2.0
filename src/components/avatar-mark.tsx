import { avatarSrc, getAvatar } from "@/domain/avatars";

const SIZE = {
  sm: "h-7 w-7",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  xl: "h-16 w-16",
} as const;

export function AvatarMark({
  avatarId,
  size = "md",
}: {
  avatarId?: string | null;
  size?: keyof typeof SIZE;
}) {
  const a = getAvatar(avatarId);
  return (
    <span
      title={a.label}
      className={`inline-flex ${SIZE[size]} shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-800 ring-1 ring-gray-600`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarSrc(a.id)}
        alt=""
        className="h-[85%] w-[85%] object-contain"
      />
    </span>
  );
}
