import { StorytellerDocumentEditorPage } from "@/pages/storyteller/documentEditor/StorytellerDocumentEditorPage.tsx";

export interface StorytellerLoreEditorProps {
  embedded?: boolean;
  projectId?: string;
  lorePublicId?: string;
}

// 設定編輯頁：跟故事編輯頁（StoryEditor）是同一個頁面元件，見 documentEditor/StorytellerDocumentEditorPage.tsx
export default function StorytellerLoreEditor({
  embedded,
  projectId,
  lorePublicId,
}: StorytellerLoreEditorProps = {}) {
  return (
    <StorytellerDocumentEditorPage
      kind="lore"
      embedded={embedded}
      projectId={projectId}
      documentPublicId={lorePublicId}
    />
  );
}
