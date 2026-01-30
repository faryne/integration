import { ImageList, ImageListItem, Pagination } from "@mui/material";
import type { ReactElement } from "react";

export interface ICustomImageList<T> {
  rows: T[];
  total: number;
  per_page: number;
  current_page: number | undefined;
  keyItemFunc: (input: T) => string;
  renderItemFunc: (input: T) => ReactElement;
  onPaginationChange: (input: number) => void;
}

export function CustomImageList<T>(props: ICustomImageList<T>) {
  return (
    <>
      {props.rows.length == 0 ? (
        <h1>沒有資料</h1>
      ) : (
        <>
          <ImageList cols={4}>
            {props.rows?.map((a) => (
              <ImageListItem
                key={props.keyItemFunc(a)}
                sx={{ textAlign: "center" }}
              >
                {props.renderItemFunc(a)}
              </ImageListItem>
            ))}
          </ImageList>
          <Pagination
            count={Math.ceil(props.total / props.per_page)}
            variant={"outlined"}
            page={props.current_page ?? 1}
            onChange={(_, v) => props.onPaginationChange(v)}
          />
        </>
      )}
    </>
  );
}
