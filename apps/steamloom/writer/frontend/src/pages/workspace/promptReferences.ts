export type PromptReference = {
  type: string;
  id: string;
  title: string;
  text: string;
  role?: string;
  thread_id?: string;
  message_id?: string;
  document_kind?: string;
  document_id?: string;
  base_version_id?: string;
};

export const promptReferencePreview = (text: string, maxCharacters = 120) => {
  const normalized = text.replace(/\s+/g, " ").trim();
  const characters = Array.from(normalized);
  return characters.length > maxCharacters ? `${characters.slice(0, maxCharacters).join("")}…` : normalized;
};
