import { redirect } from "next/navigation";
import { connection } from "next/server";

function karachiDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function DigestIndexPage() {
  await connection();
  redirect(`/digest/${karachiDate()}`);
}

