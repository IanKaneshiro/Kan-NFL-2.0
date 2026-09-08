import { avatarIdForTeamAbbr } from "@/domain/avatars";
import { AvatarMark } from "@/components/avatar-mark";

const SIZE = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-sm",
  xl: "h-16 w-16 text-base",
} as const;

export function TeamLogo({
  abbr,
  size = "md",
}: {
  abbr: string;
  size?: keyof typeof SIZE;
}) {
  const id = avatarIdForTeamAbbr(abbr);
  if (id) return <AvatarMark avatarId={id} size={size} />;
  return (
    <span
      title={abbr}
      className={`inline-flex ${SIZE[size]} shrink-0 items-center justify-center rounded-full bg-gray-700 font-bold text-white ring-1 ring-gray-600`}
    >
      {abbr.slice(0, 3).toUpperCase()}
    </span>
  );
}
