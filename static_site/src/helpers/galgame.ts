export function galgameBrandSlug(publicId: string, name: string) {
  const readableName = name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[/?#%]+/g, "");
  return readableName ? `${publicId}-${readableName}` : publicId;
}
