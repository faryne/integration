import type { ActressSearchRequest } from "@/apis/av/actress_search";
import { Button, Slider, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";

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
        <TextField
          label={"關鍵字"}
          variant={"outlined"}
          onChange={() => {
            setReq((o) => {
              return o;
            });
          }}
        />
        <Stack direction={"column"} spacing={1}>
          <Typography variant={"body2"}>
            身高 {req.height ? req.height.join("~") + "cm" : ""}
          </Typography>
          <Slider
            min={0}
            max={200}
            shiftStep={5}
            value={req.height ?? [0, 0]}
            getAriaLabel={() => "身高"}
            onChange={(_, newValue) => {
              if (
                Array.isArray(newValue) &&
                newValue.length === 2 &&
                newValue[0] <= newValue[1] &&
                (newValue[0] > 0 || newValue[1] > 0)
              ) {
                setReq((o) => ({ ...o, height: newValue as [number, number] }));
              }
            }}
          />
        </Stack>
        <Stack direction={"column"} spacing={1}>
          <Typography variant={"body2"}>
            胸圍 {req.b ? req.b.join("~") + "cm" : ""}
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
                setReq((o) => ({ ...o, b: newValue as [number, number] }));
              }
            }}
          />
        </Stack>
        <Stack direction={"column"} spacing={1}>
          <Typography variant={"body2"}>
            腰圍 {req.w ? req.w.join("~") + "cm" : ""}
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
                setReq((o) => ({ ...o, w: newValue as [number, number] }));
              }
            }}
          />
        </Stack>
        <Stack direction={"column"} spacing={1}>
          <Typography variant={"body2"}>
            臀圍 {req.h ? req.h.join("~") + "cm" : ""}
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
                setReq((o) => ({ ...o, h: newValue as [number, number] }));
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
