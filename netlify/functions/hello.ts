import type { Handler } from "@netlify/functions";

/** GET /.netlify/functions/hello or /api/hello (redirect in netlify.toml) */
export const handler: Handler = async () => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ok: true,
      message: "Hello from Netlify Functions",
    }),
  };
};
