import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // بناءٌ أحادي العامل: Supabase هنا يرفض الاتصالات المتزامنة الكثيرة،
  // وعدة عمال بناء يتجاوزون الحد فتظهر بيانات البذرة بدل بيانات المتجر.
  experimental: {
    cpus: 1,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
