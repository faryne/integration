package enum

type NekomaidSite string

const (
	NekomaidSitePixiv  NekomaidSite = "pixiv"
	NekomaidSiteNico   NekomaidSite = "nico"
	NekomaidSiteTinami NekomaidSite = "tinami"
)

type NekomaidRedisKey string

const (
	NekomaidRedisKeyPixivToken NekomaidRedisKey = "nekomaid:pixiv:token"
)
