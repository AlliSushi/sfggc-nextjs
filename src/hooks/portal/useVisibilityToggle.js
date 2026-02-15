import { useState } from "react";
import { portalFetch } from "../../utils/portal/portal-fetch.js";

const useVisibilityToggle = ({
  initialValue = false,
  endpoint,
  valueKey,
  errorMessage = "Unable to update visibility.",
}) => {
  const [value, setValue] = useState(initialValue);

  const updateVisibility = async ({ enabled, canUpdate, onError }) => {
    if (!canUpdate) return;
    const previous = value;
    setValue(enabled);
    try {
      const response = await portalFetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [valueKey]: enabled }),
      });
      if (!response.ok) {
        setValue(previous);
        onError?.(errorMessage);
      }
    } catch {
      setValue(previous);
      onError?.(errorMessage);
    }
  };

  return { value, setValue, updateVisibility };
};

export default useVisibilityToggle;
