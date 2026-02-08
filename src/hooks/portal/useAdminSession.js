import { useEffect, useState } from "react";

/**
 * Client-side hook that checks whether the current user has an active admin session.
 *
 * Returns `{ isAdmin, adminRole }`.
 *   - `isAdmin`   – true when /api/portal/admin/session responds 200
 *   - `adminRole` – the role string returned by the API (e.g. "super-admin", "admin")
 *
 * Both values start as falsy and update after the initial fetch completes.
 */
const useAdminSession = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState("");

  useEffect(() => {
    const verifySession = async () => {
      try {
        const response = await fetch("/api/portal/admin/session");
        if (!response.ok) {
          setIsAdmin(false);
          setAdminRole("");
          return;
        }
        const data = await response.json();
        setIsAdmin(true);
        setAdminRole(data?.admin?.role || "");
      } catch (err) {
        setIsAdmin(false);
        setAdminRole("");
      }
    };

    verifySession();
  }, []);

  return { isAdmin, adminRole };
};

export default useAdminSession;
