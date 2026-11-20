import type { MetadataRoute } from "next";

/** Keep table links and staff pages out of Google. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/$", disallow: ["/t/", "/admin", "/kitchen", "/login", "/staff", "/api/"] } };
}
