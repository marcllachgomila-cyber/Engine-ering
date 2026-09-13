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
};

export default nextConfig;
