import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    serverActions: {
      // Default is 1MB, too small for a multi-year, company-wide timesheet
      // export uploaded through the bulk import feature.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
