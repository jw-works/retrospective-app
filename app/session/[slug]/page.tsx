import { redirect } from "next/navigation";

export default async function SessionRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/?join=${encodeURIComponent(slug)}`);
}
