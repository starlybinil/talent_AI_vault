import Link from "next/link";
import { getContent, getFlags } from "@/lib/data";

export async function Announcement() {
  const [flags, content] = await Promise.all([getFlags(), getContent<{ text: string; href?: string }>("announcement")]);
  if (!flags.announcement_banner || !content?.text) return null;
  return (
    <div className="relative z-50 bg-maroon px-4 py-2 text-center text-sm font-bold text-white">
      {content.href ? (
        <Link href={content.href} className="underline decoration-gold decoration-2 underline-offset-4 hover:text-gold">
          {content.text}
        </Link>
      ) : (
        content.text
      )}
    </div>
  );
}
