package enum

type DBName string

const (
	DBWalolita DBName = "walolita"
	DBNekomaid DBName = "nekomaid"
)

type RedisName string

const (
	RedisDefault RedisName = "default"
)

type ESName string

const (
	ESDefault ESName = "default"
)
