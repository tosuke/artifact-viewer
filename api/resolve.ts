export const config = {
  runtime: "experimental-edge",
};

const handler = async (request: Request) => {
  const url = new URL(request.url);
  const owner = url.searchParams.get("owner");
  const repo = url.searchParams.get("repo");
  const id = url.searchParams.get("id");

  const res = await fetch(
    `https://nightly.link/${owner}/${repo}/actions/artifacts/${id}.zip`,
    { redirect: "manual" }
  );

  return res;
};

export default handler;
