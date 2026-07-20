import { redirect } from "next/navigation"

/** The organization now has one operating facility; site management is retired. */
export default function SitesPage() {
  redirect("/settings/organization")
}
