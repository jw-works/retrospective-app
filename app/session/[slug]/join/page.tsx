import { redirect } from "next/navigation";

// Share-link join route; forwards to home with join query parameter.
export default async function JoinRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/?join=${encodeURIComponent(slug)}`);
}
