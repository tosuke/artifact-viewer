// Wrapper for Vercel Edge Functions
import handler from "./_handler.js";

export default handler;

export const config = {
  runtime: "experimental-edge",
};
