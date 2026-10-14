import { StorytellerDocumentEditorPage } from "@/pages/storyteller/documentEditor/StorytellerDocumentEditorPage.tsx";

export interface StorytellerStoryEditorProps {
  embedded?: boolean;
  projectId?: string;
  storyPublicId?: string;
}

// 故事編輯頁：跟設定編輯頁（LoreEditor）是同一個頁面元件，見 documentEditor/StorytellerDocumentEditorPage.tsx
export default function StorytellerStoryEditor({
  embedded,
  projectId,
  storyPublicId,
}: StorytellerStoryEditorProps = {}) {
  return (
    <StorytellerDocumentEditorPage
      kind="story"
      embedded={embedded}
      projectId={projectId}
      documentPublicId={storyPublicId}
    />
  );
}
