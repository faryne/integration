import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type {
  NekomaidArtworkDetailResponse,
  NekomaidSearchRequest,
  NekomaidSearchResponse,
} from "@/types/nekomaid.ts";
import type { CommonResponse } from "@/apis/interfaces.ts";

const nekomaidListBaseUrl = `${import.meta.env.VITE_API_BASE}/opendata/nekomaid`;
const nekomaidDetailBaseUrl = `${import.meta.env.VITE_API_BASE}/opendata/nekomaid`;

function listUrl(input: NekomaidSearchRequest) {
  const segments = [nekomaidListBaseUrl];
  if (input.site) {
    segments.push(encodeURIComponent(input.site));
  }
  if (input.authorId) {
    segments.push(encodeURIComponent(input.authorId));
  }
  return segments.join("/");
}

export function useNekomaidSearch(input: NekomaidSearchRequest) {
  return useQuery({
    queryKey: ["nekomaid", "search", input],
    queryFn: async () => {
      const response = await axios.get<CommonResponse<NekomaidSearchResponse>>(
        listUrl(input),
        {
          params: {
            tag: input.tag || undefined,
            sites: input.sites || undefined,
            rating: input.rating || undefined,
            type: input.type || undefined,
            wallpaper: input.wallpaper || undefined,
            min_width: input.min_width || undefined,
            cursor: input.cursor || undefined,
          },
        },
      );
      return response.data.data;
    },
  });
}

export function useNekomaidArtworkDetail(
  site?: string,
  authorId?: string,
  artworkId?: string,
) {
  return useQuery({
    queryKey: ["nekomaid", "detail", site, authorId, artworkId],
    enabled: Boolean(site && authorId && artworkId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<NekomaidArtworkDetailResponse>
      >(
        `${nekomaidDetailBaseUrl}/${encodeURIComponent(site!)}/${encodeURIComponent(authorId!)}/${encodeURIComponent(artworkId!)}`,
      );
      return response.data.data;
    },
  });
}
