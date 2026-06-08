import { useTitle } from "@/helpers/title.tsx";
import { useEffect, useState } from "react";
import {
  type ActressSearchRequest,
  useAVActressSearch,
} from "@/apis/av/actress_search.ts";
import {
  Alert,
  Box,
  Chip,
  Grid,
  Pagination,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ActressSearch } from "@/components/av/actress_search";
import type { ListByPaginationRequest } from "@/apis/interfaces.ts";
import type { Actress } from "@/types/av.ts";
import FaceRetouchingNaturalIcon from "@mui/icons-material/FaceRetouchingNatural";
import SearchOffIcon from "@mui/icons-material/SearchOff";

type ActressRangeKey = "height" | "b" | "w" | "h";

const actressRangeKeys: ActressRangeKey[] = ["height", "b", "w", "h"];

const parsePositiveInt = (value: string | null) => {
  if (!value) {
    return undefined;
  }

  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed;
};

const parseRange = (value: string | null) => {
  if (!value) {
    return undefined;
  }

  const parts = value
    .split(",")
    .slice(0, 2)
    .map((part) => parseInt(part, 10));

  if (parts.length !== 2 || parts.some(Number.isNaN)) {
    return undefined;
  }

  const range = [Math.max(parts[0], 0), Math.max(parts[1], 0)];
  return range.every((part) => part <= 0) ? undefined : range;
};

const parseActressSearchParams = (
  query: URLSearchParams,
): ListByPaginationRequest<ActressSearchRequest> => {
  const page = parsePositiveInt(query.get("page")) ?? 1;
  const search: ListByPaginationRequest<ActressSearchRequest> = { page };
  const name = query.get("name")?.trim();
  const cup = query.get("cup")?.trim().toUpperCase();
  const birthYear = parsePositiveInt(query.get("birth_year"));

  if (name) {
    search.name = name;
  }
  if (cup) {
    search.cup = cup;
  }
  if (birthYear) {
    search.birth_year = birthYear;
  }

  actressRangeKeys.forEach((key) => {
    const range = parseRange(query.get(key));
    if (range) {
      search[key] = range;
    }
  });

  return search;
};

const actressSearchToParams = (
  search: ListByPaginationRequest<ActressSearchRequest>,
) => {
  const query = new URLSearchParams();
  const page = search.page ?? 1;

  if (page > 1) {
    query.set("page", String(page));
  }
  if (search.name?.trim()) {
    query.set("name", search.name.trim());
  }
  if (search.cup?.trim()) {
    query.set("cup", search.cup.trim().toUpperCase());
  }
  if (search.birth_year && search.birth_year > 0) {
    query.set("birth_year", String(search.birth_year));
  }
  actressRangeKeys.forEach((key) => {
    const range = search[key];
    if (range && range.some((value) => value > 0)) {
      query.set(key, range.slice(0, 2).join(","));
    }
  });

  return query;
};

export function AVActress() {
  const navigate = useNavigate();
  const [query, setQuery] = useSearchParams();

  const [search, setSearch] = useState<
    ListByPaginationRequest<ActressSearchRequest>
  >(() => parseActressSearchParams(query));
  const s = useAVActressSearch(search);
  useTitle("AV 女優搜尋");

  useEffect(() => {
    setSearch(parseActressSearchParams(query));
  }, [query]);

  const actresses = s.data?.data?.data ?? [];
  const total = s.data?.data?.total ?? 0;
  const perPage = s.data?.data?.per_page ?? 0;
  const pageCount = perPage > 0 ? Math.ceil(total / perPage) : 0;

  const renderBodyInfo = (actress: Actress): string => {
    const body: string[] = [];
    if (actress.cup !== "") {
      body.push(actress.cup + " Cup");
    }
    if (actress.bust > 0) {
      body.push("B" + actress.bust);
    }
    if (actress.waist > 0) {
      body.push("W" + actress.waist);
    }
    if (actress.hips > 0) {
      body.push("H" + actress.hips);
    }
    if (actress.height > 0) {
      body.push("身高 " + actress.height + "cm");
    }
    return body.join(" / ");
  };

  const renderBirth = (actress: Actress) => {
    if (actress.birth_year <= 0) {
      return "";
    }

    return [
      actress.birth_year,
      actress.birth_month > 0 ? actress.birth_month : undefined,
      actress.birth_day > 0 ? actress.birth_day : undefined,
    ]
      .filter(Boolean)
      .join("/");
  };

  const hasActiveFilter = Boolean(
    search.name ||
    search.cup ||
    search.birth_year ||
    search.height ||
    search.b ||
    search.w ||
    search.h,
  );

  const rangeLabel = (label: string, value?: number[]) =>
    value ? `${label} ${value.join("~")}` : "";

  const handleSearch = (input: ActressSearchRequest) => {
    setQuery(actressSearchToParams({ ...input, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setQuery(actressSearchToParams({ ...search, page }));
  };

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          pb: 2.5,
          textAlign: "left",
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <FaceRetouchingNaturalIcon color="primary" fontSize="large" />
          <Box>
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: "1.75rem", md: "2.25rem" },
                fontWeight: 800,
                letterSpacing: 0,
                lineHeight: 1.2,
              }}
              variant="h3"
            >
              AV 女優搜尋
            </Typography>
            <Typography color="text.secondary" variant="body2">
              依姓名、罩杯、出生年份與身形條件篩選女優資料。
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              p: 2.5,
              position: { md: "sticky" },
              textAlign: "left",
              top: { md: 24 },
            }}
          >
            <Typography fontWeight={800} sx={{ mb: 2 }} variant="h6">
              搜尋條件
            </Typography>
            <ActressSearch onClick={handleSearch} conditions={search} />
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={2.5}>
            <Box
              sx={{
                alignItems: { xs: "flex-start", sm: "center" },
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                gap: 1.5,
                justifyContent: "space-between",
                textAlign: "left",
              }}
            >
              <Box>
                <Typography fontWeight={800} variant="h6">
                  搜尋結果
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {s.isSuccess
                    ? `共 ${total.toLocaleString()} 筆資料`
                    : "讀取中"}
                </Typography>
              </Box>
              {hasActiveFilter && (
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {search.name && (
                    <Chip
                      label={`姓名：${search.name}`}
                      size="small"
                      sx={{ borderRadius: 1 }}
                    />
                  )}
                  {search.cup && (
                    <Chip
                      label={`罩杯：${search.cup}`}
                      size="small"
                      sx={{ borderRadius: 1 }}
                    />
                  )}
                  {search.birth_year && (
                    <Chip
                      label={`出生年份：${search.birth_year}`}
                      size="small"
                      sx={{ borderRadius: 1 }}
                      variant="outlined"
                    />
                  )}
                  {[
                    rangeLabel("身高", search.height),
                    rangeLabel("B", search.b),
                    rangeLabel("W", search.w),
                    rangeLabel("H", search.h),
                  ]
                    .filter(Boolean)
                    .map((label) => (
                      <Chip
                        key={label}
                        label={label}
                        size="small"
                        sx={{ borderRadius: 1 }}
                        variant="outlined"
                      />
                    ))}
                </Stack>
              )}
            </Box>

            {s.isError && (
              <Alert severity="error">搜尋資料讀取失敗，請稍後再試。</Alert>
            )}

            {(s.isLoading || s.isPending) && (
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    sm: "repeat(3, minmax(0, 1fr))",
                    lg: "repeat(4, minmax(0, 1fr))",
                  },
                }}
              >
                {Array.from({ length: 8 }).map((_, index) => (
                  <Stack key={index} spacing={1}>
                    <Skeleton
                      height={220}
                      sx={{ borderRadius: 2 }}
                      variant="rounded"
                    />
                    <Skeleton height={28} variant="rounded" />
                    <Skeleton height={22} width="72%" variant="rounded" />
                  </Stack>
                ))}
              </Box>
            )}

            {!s.isLoading && s.isSuccess && actresses.length === 0 && (
              <Box
                sx={{
                  alignItems: "center",
                  border: "1px dashed",
                  borderColor: "divider",
                  borderRadius: 2,
                  color: "text.secondary",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  justifyContent: "center",
                  minHeight: 260,
                  px: 3,
                  textAlign: "center",
                }}
              >
                <SearchOffIcon fontSize="large" />
                <Typography fontWeight={800} variant="h6">
                  沒有符合條件的女優
                </Typography>
                <Typography variant="body2">
                  調整姓名、罩杯或身形範圍後再搜尋。
                </Typography>
              </Box>
            )}

            {!s.isLoading && s.isSuccess && actresses.length > 0 && (
              <>
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: {
                      xs: "repeat(2, minmax(0, 1fr))",
                      sm: "repeat(3, minmax(0, 1fr))",
                      lg: "repeat(4, minmax(0, 1fr))",
                    },
                  }}
                >
                  {actresses.map((actress) => {
                    const bodyInfo = renderBodyInfo(actress);
                    const birth = renderBirth(actress);

                    return (
                      <Box
                        component="button"
                        key={actress.name}
                        onClick={() =>
                          navigate(
                            `/av/actress/${encodeURIComponent(actress.name)}`,
                          )
                        }
                        sx={{
                          appearance: "none",
                          bgcolor: "background.paper",
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 2,
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          overflow: "hidden",
                          p: 0,
                          textAlign: "left",
                          transition:
                            "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
                          width: "100%",
                          "&:focus-visible": {
                            borderColor: "primary.main",
                            boxShadow: "0 0 0 3px rgba(25, 118, 210, 0.28)",
                            outline: 0,
                          },
                          "&:hover": {
                            borderColor: "rgba(25, 118, 210, 0.42)",
                            boxShadow: "0 14px 34px rgba(15, 23, 42, 0.13)",
                            transform: "translateY(-2px)",
                          },
                        }}
                      >
                        <Box
                          sx={{
                            aspectRatio: "3 / 4",
                            bgcolor: "grey.100",
                            overflow: "hidden",
                            width: "100%",
                          }}
                        >
                          <Box
                            component="img"
                            src={actress.photo}
                            alt={actress.name}
                            loading="lazy"
                            sx={{
                              display: "block",
                              height: "100%",
                              objectFit: "cover",
                              width: "100%",
                            }}
                          />
                        </Box>
                        <Stack spacing={0.75} sx={{ p: 1.5 }}>
                          <Typography
                            sx={{
                              color: "text.primary",
                              fontWeight: 800,
                              letterSpacing: 0,
                              lineHeight: 1.3,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            variant="body1"
                          >
                            {actress.name}
                          </Typography>
                          {actress.kana && (
                            <Typography
                              color="text.secondary"
                              sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              variant="caption"
                            >
                              {actress.kana}
                            </Typography>
                          )}
                          <Typography
                            color="text.secondary"
                            sx={{
                              minHeight: "2.86em",
                              overflow: "hidden",
                            }}
                            variant="body2"
                          >
                            {bodyInfo || "未登錄身形資訊"}
                          </Typography>
                          {birth && (
                            <Chip
                              label={`生日 ${birth}`}
                              size="small"
                              sx={{
                                alignSelf: "flex-start",
                                borderRadius: 1,
                                fontSize: "0.72rem",
                              }}
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      </Box>
                    );
                  })}
                </Box>

                {pageCount > 1 && (
                  <Box
                    sx={{ display: "flex", justifyContent: "center", pt: 1 }}
                  >
                    <Pagination
                      count={pageCount}
                      onChange={(_, page) => handlePageChange(page)}
                      page={search.page ?? 1}
                      shape="rounded"
                      variant="outlined"
                    />
                  </Box>
                )}
              </>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}
