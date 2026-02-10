import { redirect } from "next/navigation";

// Legacy route kept for compatibility; canonical entry point is "/".
export default function CreateSessionRedirectPage() {
  redirect("/");
}
