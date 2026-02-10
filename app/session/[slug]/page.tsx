import { redirect } from "next/navigation";

// Redirects route-style links to the single shared page model.
export default async function SessionRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/?join=${encodeURIComponent(slug)}`);
}
