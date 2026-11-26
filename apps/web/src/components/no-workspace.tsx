import Link from "next/link";

export function NoWorkspace() {
  return (
    <div className="p-8">
      <p className="text-muted-foreground">You are not in a workspace yet.</p>
      <Link
        href="/members"
        className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
      >
        Create one on the Members page
      </Link>
    </div>
  );
}
