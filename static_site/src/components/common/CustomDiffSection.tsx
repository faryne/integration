import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { CustomDiffLine } from "@/components/common/customDiff.ts";
import { CustomDiffPane } from "@/components/common/CustomDiffPane.tsx";

interface CustomDiffSectionProps {
  leftMetadataLabels?: string[];
  leftTitle?: string;
  lines: CustomDiffLine[];
  rightMetadataLabels?: string[];
  rightTitle?: string;
  title: string;
}

export function CustomDiffSection({
  leftMetadataLabels = [],
  leftTitle = "舊版本",
  lines,
  rightMetadataLabels = [],
  rightTitle = "新版本",
  title,
}: CustomDiffSectionProps) {
  const unchanged = lines.every((line) => line.state === "same");

  return (
    <Accordion defaultExpanded={!unchanged} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Typography fontWeight={800}>{title}</Typography>
          <Chip
            size="small"
            label={unchanged ? "無變更" : "有變動"}
            color={unchanged ? "default" : "warning"}
          />
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        {unchanged ? (
          <Paper variant="outlined" sx={{ borderRadius: 1, p: 2 }}>
            <Typography color="text.secondary">無變更</Typography>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <CustomDiffPane
                title={leftTitle}
                metadataLabels={leftMetadataLabels}
                side="left"
                lines={lines}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <CustomDiffPane
                title={rightTitle}
                metadataLabels={rightMetadataLabels}
                side="right"
                lines={lines}
              />
            </Grid>
          </Grid>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
