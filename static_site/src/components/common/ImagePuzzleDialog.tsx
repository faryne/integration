import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CasinoOutlinedIcon from "@mui/icons-material/CasinoOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useEffect, useId, useMemo, useRef, useState } from "react";

type HeadbreakerModule = {
  Canvas: new (
    id: string,
    options: {
      borderFill?: number;
      height: number;
      image?: HTMLImageElement;
      lineSoftness?: number;
      pieceSize?: number;
      preventOffstageDrag?: boolean;
      proximity?: number;
      strokeColor?: string;
      strokeWidth?: number;
      width: number;
    },
  ) => {
    adjustImagesToPuzzleWidth: () => void;
    autogenerate: (options?: {
      horizontalPiecesCount?: number;
      insertsGenerator?: unknown;
      verticalPiecesCount?: number;
    }) => void;
    draw: () => void;
    redraw?: () => void;
    shuffle: (farness?: number) => void;
    solve: () => void;
  };
  generators?: {
    random?: unknown;
  };
};

interface ImagePuzzleDialogProps {
  imageUrl: string;
  onClose: () => void;
  open: boolean;
  title: string;
}

interface PuzzleSize {
  canvasHeight: number;
  canvasWidth: number;
  horizontalPiecesCount: number;
  pieceSize: number;
  verticalPiecesCount: number;
}

function calculatePuzzleSize(image: HTMLImageElement): PuzzleSize {
  const maxCanvasWidth = Math.min(window.innerWidth - 32, 980);
  const maxCanvasHeight = Math.min(window.innerHeight - 160, 720);
  const scale = Math.min(
    maxCanvasWidth / image.naturalWidth,
    maxCanvasHeight / image.naturalHeight,
    1,
  );
  const canvasWidth = Math.max(280, Math.floor(image.naturalWidth * scale));
  const canvasHeight = Math.max(220, Math.floor(image.naturalHeight * scale));
  const horizontalPiecesCount = Math.min(
    8,
    Math.max(3, Math.round(canvasWidth / 150)),
  );
  const verticalPiecesCount = Math.min(
    8,
    Math.max(3, Math.round(canvasHeight / 150)),
  );

  return {
    canvasHeight,
    canvasWidth,
    horizontalPiecesCount,
    pieceSize: Math.max(56, Math.round(canvasWidth / horizontalPiecesCount)),
    verticalPiecesCount,
  };
}

async function loadHeadbreaker() {
  const imported = await import("headbreaker");
  const headbreaker = ((imported as { default?: HeadbreakerModule }).default ??
    imported) as HeadbreakerModule;

  // headbreaker's default Konva painter reads itself from window.headbreaker.
  (window as unknown as { headbreaker: HeadbreakerModule }).headbreaker =
    headbreaker;

  return headbreaker;
}

export function ImagePuzzleDialog({
  imageUrl,
  onClose,
  open,
  title,
}: ImagePuzzleDialogProps) {
  const generatedId = useId();
  const puzzleId = useMemo(
    () => `image-puzzle-${generatedId.replace(/:/g, "")}`,
    [generatedId],
  );
  const [error, setError] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [previewSecondsLeft, setPreviewSecondsLeft] = useState(0);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const isPreviewingOriginal = previewSecondsLeft > 0;

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setError("");
    setIsReady(false);
    setPreviewSecondsLeft(0);

    const initializePuzzle = async () => {
      try {
        const [headbreaker, image] = await Promise.all([
          loadHeadbreaker(),
          new Promise<HTMLImageElement>((resolve, reject) => {
            const loadedImage = new Image();
            loadedImage.onload = () => resolve(loadedImage);
            loadedImage.onerror = () => reject(new Error("圖片載入失敗"));
            loadedImage.src = imageUrl;
          }),
        ]);

        if (cancelled || !canvasRef.current) {
          return;
        }

        canvasRef.current.replaceChildren();
        const {
          canvasHeight,
          canvasWidth,
          horizontalPiecesCount,
          pieceSize,
          verticalPiecesCount,
        } = calculatePuzzleSize(image);

        const puzzle = new headbreaker.Canvas(puzzleId, {
          borderFill: 8,
          height: canvasHeight,
          image,
          lineSoftness: 0.14,
          pieceSize,
          preventOffstageDrag: true,
          proximity: Math.max(12, Math.round(pieceSize * 0.18)),
          strokeColor: "#f8fafc",
          strokeWidth: 1.6,
          width: canvasWidth,
        });

        puzzle.adjustImagesToPuzzleWidth();
        puzzle.autogenerate({
          horizontalPiecesCount,
          insertsGenerator: headbreaker.generators?.random,
          verticalPiecesCount,
        });
        puzzle.shuffle(0.72);
        puzzle.draw();
        setIsReady(true);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "拼圖初始化失敗");
        }
      }
    };

    void initializePuzzle();

    return () => {
      cancelled = true;
      canvasRef.current?.replaceChildren();
    };
  }, [imageUrl, open, puzzleId, shuffleSeed]);

  useEffect(() => {
    if (!open || previewSecondsLeft <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPreviewSecondsLeft((secondsLeft) => {
        if (secondsLeft <= 1) {
          setShuffleSeed((seed) => seed + 1);
          return 0;
        }
        return secondsLeft - 1;
      });
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [open, previewSecondsLeft]);

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          bgcolor: "#07111f",
          color: "#f8fafc",
        },
      }}
    >
      <Box
        sx={{
          alignItems: "center",
          bgcolor: "rgba(7, 17, 31, 0.94)",
          borderBottom: "1px solid rgba(248,250,252,0.12)",
          display: "flex",
          gap: 1,
          justifyContent: "space-between",
          px: { xs: 1, md: 2 },
          py: 1,
        }}
      >
        <Stack direction="row" spacing={1}>
          <ExtensionOutlinedIcon sx={{ color: "#fbbf24", mt: 0.5 }} />
          <Typography fontWeight={900} sx={{ pt: 0.5 }} variant="body2">
            拼圖彩蛋
          </Typography>
        </Stack>
        <Typography
          fontWeight={900}
          sx={{
            minWidth: 0,
            overflow: "hidden",
            textAlign: "center",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          variant="body2"
        >
          {title}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="重新打散">
            <span>
              <IconButton
                aria-label="重新打散拼圖"
                disabled={!isReady || isPreviewingOriginal}
                onClick={() => setShuffleSeed((seed) => seed + 1)}
                sx={{ color: "#f8fafc" }}
              >
                <RestartAltIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="看原圖 30 秒">
            <span>
              <IconButton
                aria-label="看原圖 30 秒"
                disabled={!isReady || isPreviewingOriginal}
                onClick={() => setPreviewSecondsLeft(30)}
                sx={{ color: "#f8fafc" }}
              >
                <ImageOutlinedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="關閉">
            <IconButton
              aria-label="關閉拼圖"
              onClick={onClose}
              sx={{ color: "#f8fafc" }}
            >
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
      <Box
        sx={{
          alignItems: "center",
          background:
            "radial-gradient(circle at 20% 20%, rgba(251,191,36,0.18), transparent 28%), linear-gradient(135deg, #07111f 0%, #0f172a 52%, #111827 100%)",
          display: "flex",
          minHeight: "calc(100vh - 57px)",
          overflow: "auto",
          p: { xs: 2, md: 3 },
        }}
      >
        <Stack
          alignItems="center"
          spacing={2}
          sx={{
            mx: "auto",
            minWidth: 0,
          }}
        >
          {!isReady && !error && (
            <Stack alignItems="center" spacing={1.5}>
              <CircularProgress color="inherit" size={30} thickness={4} />
              <Typography fontWeight={800} variant="body2">
                拼圖準備中
              </Typography>
            </Stack>
          )}
          {error && (
            <Alert severity="warning" sx={{ maxWidth: 520 }}>
              {error}。請確認圖片來源目前可被瀏覽器載入。
            </Alert>
          )}
          <Box
            id={puzzleId}
            ref={canvasRef}
            sx={{
              border: "1px solid rgba(248,250,252,0.18)",
              borderRadius: 2,
              boxShadow: "0 24px 80px rgba(0,0,0,0.38)",
              maxWidth: "100%",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {isPreviewingOriginal && (
              <Box
                sx={{
                  alignItems: "center",
                  bgcolor: "rgba(7, 17, 31, 0.94)",
                  display: "flex",
                  inset: 0,
                  justifyContent: "center",
                  p: 2,
                  position: "absolute",
                  zIndex: 3,
                }}
              >
                <Box
                  component="img"
                  src={imageUrl}
                  alt={`${title} 原圖`}
                  sx={{
                    borderRadius: 1.5,
                    display: "block",
                    maxHeight: "min(72vh, 720px)",
                    maxWidth: "min(100%, 980px)",
                    objectFit: "contain",
                  }}
                />
              </Box>
            )}
          </Box>
          {isReady && (
            <Stack
              alignItems="center"
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
            >
              <Button
                disabled={isPreviewingOriginal}
                onClick={() => setShuffleSeed((seed) => seed + 1)}
                startIcon={<CasinoOutlinedIcon />}
                sx={{
                  bgcolor: "rgba(251, 191, 36, 0.16)",
                  borderColor: "#f59e0b",
                  color: "#fbbf24",
                  fontWeight: 900,
                  "&:hover": {
                    bgcolor: "rgba(251, 191, 36, 0.24)",
                    borderColor: "#fbbf24",
                  },
                  "&.Mui-disabled": {
                    borderColor: "rgba(248,250,252,0.16)",
                    color: "rgba(248,250,252,0.38)",
                  },
                }}
                variant="outlined"
              >
                重新打散
              </Button>
              <Button
                disabled={isPreviewingOriginal}
                onClick={() => setPreviewSecondsLeft(30)}
                startIcon={<ImageOutlinedIcon />}
                sx={{
                  borderColor: "rgba(248,250,252,0.42)",
                  color: "#f8fafc",
                  fontWeight: 900,
                  "&.Mui-disabled": {
                    borderColor: "rgba(248,250,252,0.16)",
                    color: "rgba(248,250,252,0.38)",
                  },
                }}
                variant="outlined"
              >
                看原圖
              </Button>
              {isPreviewingOriginal && (
                <Typography
                  color="rgba(248,250,252,0.78)"
                  fontWeight={800}
                  variant="body2"
                >
                  {previewSecondsLeft} 秒後重新打散
                </Typography>
              )}
            </Stack>
          )}
        </Stack>
      </Box>
    </Dialog>
  );
}
