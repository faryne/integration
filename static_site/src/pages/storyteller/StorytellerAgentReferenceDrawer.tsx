import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Chip,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";

interface StorytellerAgentReferenceDrawerProps {
  open: boolean;
  onClose: () => void;
}

const referenceExamples = [
  {
    token: "@thisStory",
    title: "目前故事",
    description: "在故事編輯頁引用目前正在編輯的故事內容。",
  },
  {
    token: "@story:[故事標題]",
    title: "指定故事",
    description: "引用同一個專案內指定標題的故事。",
  },
  {
    token: "@thisLore",
    title: "目前設定集",
    description: "在設定集編輯頁引用目前正在編輯的設定集內容。",
  },
  {
    token: "@lore:[設定集標題]",
    title: "指定設定集",
    description: "引用同一個專案內指定標題的設定集。",
  },
];

export function StorytellerAgentReferenceDrawer(
  props: StorytellerAgentReferenceDrawerProps,
) {
  return (
    <Drawer anchor="right" open={props.open} onClose={props.onClose}>
      <Box sx={{ width: { xs: 320, sm: 420 }, p: 2 }}>
        <Stack spacing={2}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography variant="h6" fontWeight={800}>
              引用標籤
            </Typography>
            <IconButton size="small" onClick={props.onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            AI Agent
            送出時會把引用標籤展開成對應故事或設定集內容，讓模型可以根據上下文回覆。
          </Typography>

          <Stack spacing={1.5}>
            {referenceExamples.map((item) => (
              <Box
                key={item.token}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  p: 1.5,
                }}
              >
                <Stack spacing={1}>
                  <Chip
                    size="small"
                    label={item.token}
                    sx={{
                      alignSelf: "flex-start",
                      fontFamily:
                        '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
                    }}
                  />
                  <Typography variant="subtitle2" fontWeight={800}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.description}
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Stack>

          <Box
            sx={{
              borderRadius: 1,
              bgcolor: "background.default",
              p: 1.5,
            }}
          >
            <Typography variant="subtitle2" fontWeight={800} gutterBottom>
              特殊標題
            </Typography>
            <Typography variant="body2" color="text.secondary">
              標題含空白或中括號時，請使用候選按鈕插入引用。若手動輸入，右中括號需要寫成{" "}
              <Box component="code" sx={{ fontFamily: "monospace" }}>
                \]
              </Box>
              ，例如{" "}
              <Box component="code" sx={{ fontFamily: "monospace" }}>
                @story:[[aaa\] bbb p [CCC\]]
              </Box>
              。
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Drawer>
  );
}
