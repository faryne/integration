import { Link } from "@mui/material";
import { Fragment } from "react";

// 網址到空白為止；split 用帶括號的 regex，網址本身也會留在結果陣列的奇數位置
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

/** 把文字裡的網址轉成可以點的連結，其餘照原樣輸出（外部來的文字，不用 innerHTML） */
export function LinkifiedText({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_PATTERN).map((part, i) =>
        i % 2 === 1 ? (
          <Link
            key={i}
            href={part}
            target={"_blank"}
            rel={"noopener noreferrer"}
          >
            {part}
          </Link>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
