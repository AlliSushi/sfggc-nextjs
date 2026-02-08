const buildUrl = (path) => {
  const base = process.env.NEXT_PUBLIC_PORTAL_API_BASE || "";
  return `${base}${path}`;
};

const portalGet = async (path) => {
  const response = await fetch(buildUrl(path));
  return response.json();
};

const portalPost = async (path, payload) => {
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return response.json();
};

export { portalGet, portalPost };
