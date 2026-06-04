import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import axios from "axios";
import type {
  NekomaidArtworkDetailResponse,
  NekomaidSearchRequest,
  NekomaidSearchResponse,
} from "@/types/nekomaid.ts";

const nekomaidBaseUrl = "https://faryne.dev/api/opendata/nekomaid";

function listUrl(input: NekomaidSearchRequest) {
  const segments = [nekomaidBaseUrl];
  if (input.site) {
    segments.push(encodeURIComponent(input.site));
  }
  if (input.authorId) {
    segments.push(encodeURIComponent(input.authorId));
  }
  return segments.join("/");
}

export function useNekomaidSearch(input: NekomaidSearchRequest) {
  return useInfiniteQuery({
    queryKey: ["nekomaid", "legacy-search", input],
    initialPageParam: "",
    queryFn: async ({ pageParam }) => {
      const response = await axios.get<NekomaidSearchResponse>(listUrl(input), {
        params: {
          tag: input.tag || undefined,
          sites: input.sites || undefined,
          rating: input.rating || undefined,
          type: input.type || undefined,
          wallpaper: input.wallpaper || undefined,
          min_width: input.min_width || undefined,
          next_token: pageParam || undefined,
        },
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.next_token || undefined,
  });
}

export function useNekomaidArtworkDetail(
  site?: string,
  authorId?: string,
  artworkId?: string,
) {
  return useQuery({
    queryKey: ["nekomaid", "legacy-detail", site, authorId, artworkId],
    enabled: Boolean(site && authorId && artworkId),
    queryFn: async () => {
      const response = await axios.get<NekomaidArtworkDetailResponse>(
        `${nekomaidBaseUrl}/${encodeURIComponent(site!)}/${encodeURIComponent(authorId!)}/${encodeURIComponent(artworkId!)}`,
      );
      return response.data;
    },
  });
}
