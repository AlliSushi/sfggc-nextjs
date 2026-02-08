const methodNotAllowed = (req, res, allowed = []) => {
  res.setHeader("Allow", allowed);
  res.status(405).end(`Method ${req.method} Not Allowed`);
};

const unauthorized = (res, message = "Unauthorized") => {
  res.status(401).json({ error: message });
};

const forbidden = (res, message = "Forbidden") => {
  res.status(403).json({ error: message });
};

export { methodNotAllowed, unauthorized, forbidden };
