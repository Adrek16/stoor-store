import type { NextConfig } from "next";

// Netlify وVercel يستخدمان مخرجات البناء الخاصة بهما، و`standalone`
// مخصّص لحزمة التشغيل الذاتي على خادم Node. Netlify يضبط NETLIFY=true.
const isPlatformBuild = Boolean(process.env.NETLIFY) || Boolean(process.env.VERCEL);

const nextConfig: NextConfig = {
  /* config options here */
  output: isPlatformBuild ? undefined : "standalone",
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
