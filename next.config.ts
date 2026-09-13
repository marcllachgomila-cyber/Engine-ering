import type { NextConfig } from "next";

// GitHub Pages serves this repo at /Engine-ering/, so the build needs that
// prefix baked in. Keep it off for local dev/preview, where the app is
// served from the domain root instead.
const isGithubPagesBuild = process.env.GITHUB_ACTIONS === "true";
const repoBasePath = "/Engine-ering";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isGithubPagesBuild ? repoBasePath : "",
  assetPrefix: isGithubPagesBuild ? repoBasePath : "",
  env: {
    // basePath isn't applied to plain CSS/HTML url()s the way it is for
    // next/link and next/image, so hand-written references to /public
    // assets (e.g. the body background image) need this to build their own URL.
    NEXT_PUBLIC_BASE_PATH: isGithubPagesBuild ? repoBasePath : "",
  },
};

export default nextConfig;
