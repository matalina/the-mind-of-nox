/**
 * Example Netlify Function.
 * Local / prod: GET /.netlify/functions/hello or GET /api/hello (see netlify.toml redirect)
 */
exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ok: true,
      message: "Hello from Netlify Functions",
    }),
  };
};
