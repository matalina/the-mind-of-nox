/**
 * Build environment flags, available in templates as `env`.
 *
 * `isProduction` is true only on Netlify's production deploy. Netlify sets
 * CONTEXT="production" for the live site, and "deploy-preview"/"branch-deploy"
 * otherwise. Locally (npm run serve / dev / build) CONTEXT is unset, so this is
 * false — which is how we keep local and preview traffic out of analytics.
 */
export default {
  isProduction: process.env.CONTEXT === "production",
};
