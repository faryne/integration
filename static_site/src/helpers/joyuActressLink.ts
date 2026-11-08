import type { JoyuActressItem } from "@/apis/av/joyu.ts";
import { actressPagePath } from "@/helpers/avActressRef.ts";
import { joyuPath } from "@/helpers/joyu.ts";

/** 出演者連結：對得到女優就進女優頁（帶參數，同名才分得開），對不到就用名字進女優搜尋 */
export const joyuActressLink = (item: JoyuActressItem) =>
  item.actress
    ? actressPagePath(item.actress.name, item.actress)
    : joyuPath(`actress?name=${encodeURIComponent(item.name)}`);
