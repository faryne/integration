import type { ActressSearchRequest } from "@/apis/av/actress_search";
import { Button, Slider, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";

export interface IActressSearch {
  onClick: (input: ActressSearchRequest) => void;
  conditions?: ActressSearchRequest;
}
export function ActressSearch(props: IActressSearch) {
  const [req, setReq] = useState<ActressSearchRequest>({
    page: 1,
  });
  if (props.conditions) {
    setReq((o) => ({ ...o, ...props.conditions }));
  }

  return (
    <>
      {JSON.stringify(req)}
      <Stack direction={"column"} spacing={2} sx={{ marginTop: "10px" }}>
        <Stack direction={"column"} spacing={1}>
          <TextField
            label={"關鍵字"}
            variant={"outlined"}
            value={req.name}
            onChange={(e) => {
              setReq((o) => {
                return { ...o, ...{ keyword: e.target.value } };
              });
            }}
          />
          <TextField
            label={"罩杯"}
            variant={"outlined"}
            value={req.cup}
            onChange={(e) => {
              setReq((o) => {
                return { ...o, ...{ cup: e.target.value } };
              });
            }}
          />
          <TextField
            type={"number"}
            aria-valuemin={1900}
            aria-valuemax={2100}
            label={"出生年份"}
            variant={"outlined"}
            value={req.birth_year ?? 0}
            onChange={(e) => {
              setReq((o) => {
                if (!isNaN(parseInt(e.target.value, 10))) {
                  return {
                    ...o,
                    ...{ birth_year: parseInt(e.target.value, 10) },
                  };
                }
                return o;
              });
            }}
          />
        </Stack>
        <Stack direction={"column"} spacing={1}>
          <Typography variant={"body2"}>
            身高 {req.height ? req.height.join("~") + "cm" : ""}
            {req.height && (
              <RemoveCircleOutlineIcon
                onClick={() =>
                  setReq((o) => {
                    const tmp = o;
                    if (tmp.height) {
                      delete tmp.height;
                    }
                    return { ...tmp };
                  })
                }
              ></RemoveCircleOutlineIcon>
            )}
          </Typography>
          <Slider
            min={0}
            max={200}
            step={5}
            value={req.height ?? [0, 0]}
            getAriaLabel={() => "身高"}
            onReset={() => setReq((o) => ({ ...o, height: [0, 0] }))}
            onChange={(_, newValue) => {
              if (
                Array.isArray(newValue) &&
                newValue.length === 2 &&
                newValue[0] <= newValue[1] &&
                (newValue[0] > 0 || newValue[1] >= 0)
              ) {
                setReq((o) => ({
                  ...o,
                  height: [newValue[0], newValue[1] == 5 ? 0 : newValue[1]],
                }));
              }
            }}
          />
        </Stack>
        <Stack direction={"column"} spacing={1}>
          <Typography variant={"body2"}>
            胸圍 {req.b ? req.b.join("~") + "cm" : ""}
            {req.b && (
              <RemoveCircleOutlineIcon
                onClick={() =>
                  setReq((o) => {
                    const tmp = o;
                    if (tmp.b) {
                      delete tmp.b;
                    }
                    return { ...tmp };
                  })
                }
              ></RemoveCircleOutlineIcon>
            )}
          </Typography>
          <Slider
            min={0}
            max={150}
            value={req.b ?? [0, 0]}
            getAriaLabel={() => "胸圍"}
            onChange={(_, newValue) => {
              if (
                Array.isArray(newValue) &&
                newValue.length === 2 &&
                newValue[0] <= newValue[1] &&
                (newValue[0] > 0 || newValue[1] > 0)
              ) {
                setReq((o) => ({
                  ...o,
                  b: [newValue[0], newValue[1] == 1 ? 0 : newValue[1]],
                }));
              }
            }}
          />
        </Stack>
        <Stack direction={"column"} spacing={1}>
          <Typography variant={"body2"}>
            腰圍 {req.w ? req.w.join("~") + "cm" : ""}
            {req.w && (
              <RemoveCircleOutlineIcon
                onClick={() =>
                  setReq((o) => {
                    const tmp = o;
                    if (tmp.w) {
                      delete tmp.w;
                    }
                    return { ...tmp };
                  })
                }
              ></RemoveCircleOutlineIcon>
            )}
          </Typography>
          <Slider
            min={0}
            max={120}
            value={req.w ?? [0, 0]}
            getAriaLabel={() => "腰圍"}
            onChange={(_, newValue) => {
              if (
                Array.isArray(newValue) &&
                newValue.length === 2 &&
                newValue[0] <= newValue[1] &&
                (newValue[0] > 0 || newValue[1] > 0)
              ) {
                setReq((o) => ({
                  ...o,
                  w: [newValue[0], newValue[1] == 1 ? 0 : newValue[1]],
                }));
              }
            }}
          />
        </Stack>
        <Stack direction={"column"} spacing={1}>
          <Typography variant={"body2"}>
            臀圍 {req.h ? req.h.join("~") + "cm" : ""}
            {req.h && (
              <RemoveCircleOutlineIcon
                onClick={() =>
                  setReq((o) => {
                    const tmp = o;
                    if (tmp.h) {
                      delete tmp.h;
                    }
                    return { ...tmp };
                  })
                }
              ></RemoveCircleOutlineIcon>
            )}
          </Typography>
          <Slider
            min={0}
            max={150}
            value={req.h ?? [0, 0]}
            getAriaLabel={() => "臀圍"}
            onChange={(_, newValue) => {
              if (
                Array.isArray(newValue) &&
                newValue.length === 2 &&
                newValue[0] <= newValue[1] &&
                (newValue[0] > 0 || newValue[1] > 0)
              ) {
                setReq((o) => ({
                  ...o,
                  h: [newValue[0], newValue[1] == 1 ? 0 : newValue[1]],
                }));
              }
            }}
          />
        </Stack>

        <Button onClick={() => props.onClick(req)} variant={"contained"}>
          搜尋
        </Button>
      </Stack>
    </>
  );
}
