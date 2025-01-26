export const formatValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return { type: "null", value: null };
  }

  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return { type: "integer", value: value.toString() };
    }
    return { type: "float", value: value.toString() };
  }

  return { type: "text", value: value.toString() };
};
