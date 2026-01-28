import { useTitle } from "@/helpers/title.tsx";
import { useState } from "react";
import {
  type ActressSearchRequest,
  useAVActressSearch,
} from "@/apis/av/actress_search.ts";
import {
  Grid,
  ImageListItemBar,
} from "@mui/material";
import { ActressSummary } from "@/components/av/actress_summary.tsx";
import { useNavigate } from "react-router-dom";
import { ActressSearch } from "@/components/av/actress_search";
import type {ListByPaginationRequest} from "@/apis/interfaces.ts";
import {CustomImageList} from "@/components/common/CustomImageList.tsx";

export function AVActress() {
  const navigate = useNavigate();

  const [search, setSearch] = useState<ListByPaginationRequest<ActressSearchRequest>>({
    page: 1,
  });
  const s = useAVActressSearch(search);
  useTitle("女優搜尋");

  const render3Size = (
    cup: string,
    b: number,
    w: number,
    h: number,
    height: number,
  ): string => {
    const body: string[] = [];
    if (cup != "") {
      body.push(cup + " Cup");
    }
    if (b > 0) {
      body.push("B" + b);
    }
    if (w > 0) {
      body.push("W" + w);
    }
    if (h > 0) {
      body.push("H" + h);
    }
    if (height > 0) {
      body.push("身高：" + height + "cm");
    }
    return body.join(" ");
  };
  return (
    <>
      <Grid container>
        <Grid size={3}>
          <ActressSearch
            onClick={(r) => {
              setSearch((o) => ({ ...o, ...r }));
            }}
          />
        </Grid>
        <Grid size={1}></Grid>
        <Grid size={8}>
          <CustomImageList
              rows={s.data?.data?.data ?? []}
              total={s.data?.data?.total ?? 0}
              per_page={s.data?.data?.per_page ?? 0}
              current_page={search.page}
              keyItemFunc={(a) => a.name}
              renderItemFunc={(a) => (
                  <>
                    <ActressSummary
                        actress={a}
                        onClick={(a) => navigate(`/av/actress/${a.name}`)}
                    />
                    <ImageListItemBar
                        title={a.name}
                        subtitle={render3Size(
                            a.cup,
                            a.bust,
                            a.waist,
                            a.hips,
                            a.height,
                        )}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/av/actress/${a.name}`)
                        }}
                    ></ImageListItemBar>
                  </>
              )}
              onPaginationChange={(p) => setSearch((o) => ({ ...o, page: p }))}
          />
        </Grid>
      </Grid>
    </>
  );
}
