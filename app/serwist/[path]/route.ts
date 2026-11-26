import { randomUUID } from "node:crypto";
import { createSerwistRoute } from "@serwist/turbopack";

const revision = randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    additionalPrecacheEntries: [{ url: "/offline", revision }],
    globPatterns: [
      ".next/static/**/*.{js,css,html,ico,apng,png,avif,jpg,jpeg,jfif,pjpeg,pjp,gif,svg,webp,json,webmanifest,woff2}",
      "public/**/*",
    ],
    swSrc: "app/sw.ts",
    useNativeEsbuild: true,
  });
