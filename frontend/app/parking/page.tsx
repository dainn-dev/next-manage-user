import { redirect } from "next/navigation"

/** Canonical parking entry — sub-routes live under /parking/*. */
export default function ParkingIndexPage() {
  redirect("/parking/maps")
}
