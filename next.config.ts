import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_EXTERNAL_URL: process.env.EXTERNAL_URL,
  },
};

export default withNextIntl(nextConfig);
