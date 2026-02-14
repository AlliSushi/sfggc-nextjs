const sumNullableValues = (values) => {
  const nonNull = values.filter((value) => value != null);
  if (nonNull.length === 0) return null;
  return nonNull.reduce((sum, value) => sum + value, 0);
};

const sumFieldAcrossMembers = (members, field) =>
  sumNullableValues(members.map((member) => member[field]));

export { sumNullableValues, sumFieldAcrossMembers };
