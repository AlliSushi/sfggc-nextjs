import { toTeamSlug } from "./slug.js";
import { EM_DASH } from "./display-constants.js";

const normalizeQueryValue = (value) => {
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return value || "";
};

const isSafeInternalPath = (value) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return false;
  if (trimmed.startsWith("//")) return false;
  if (trimmed.includes("://")) return false;
  return true;
};

const resolveBackHref = (from, fallback = "/portal/admin/dashboard") => {
  const normalizedFrom = normalizeQueryValue(from);
  if (isSafeInternalPath(normalizedFrom)) {
    return normalizedFrom;
  }
  return fallback;
};

const appendFromParam = (href, from) => {
  const normalizedFrom = normalizeQueryValue(from);
  if (!isSafeInternalPath(normalizedFrom)) {
    return href;
  }
  const [withoutHash, hash = ""] = href.split("#");
  const [pathname, queryString = ""] = withoutHash.split("?");
  const params = new URLSearchParams(queryString);
  params.set("from", normalizedFrom);
  const qs = params.toString();
  return `${pathname}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
};

const resolveLaneEntryHref = (entry, from) => {
  if (entry?.pid) {
    return appendFromParam(`/portal/participant/${entry.pid}`, from);
  }

  const teamSlug = entry?.teamSlug || toTeamSlug(entry?.label || "");
  if (teamSlug && entry?.label && entry.label !== EM_DASH) {
    return appendFromParam(`/portal/team/${teamSlug}`, from);
  }

  return "";
};

export { normalizeQueryValue, resolveBackHref, appendFromParam, resolveLaneEntryHref };
